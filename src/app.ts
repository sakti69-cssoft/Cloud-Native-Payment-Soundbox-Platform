import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import swaggerUi from "swagger-ui-express";
import client from "prom-client";
import { z, ZodError } from "zod";
import type { Repository } from "./repositories/repository.js";
import type { PaymentPublisher } from "./mqtt/publisher.js";
import { paymentMessage } from "./mqtt/publisher.js";
import { logger } from "./config/logger.js";
import { env } from "./config/env.js";
import { adminAuth, correlation, errors, hmacAuth } from "./middleware/http.js";
import { languages } from "./types/domain.js";
const merchantSchema = z.object({
  merchantCode: z.string().regex(/^[A-Z0-9-]{3,40}$/),
  merchantName: z.string().min(2).max(120),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});
const deviceSchema = z.object({
  merchantId: z.uuid(),
  deviceCode: z.string().regex(/^[A-Z0-9-]{3,50}$/),
  serialNumber: z.string().min(3).max(80),
  language: z.enum(languages).default("en"),
});
const paymentSchema = z.object({
  merchantCode: z.string(),
  transactionReference: z.string().regex(/^[A-Za-z0-9-]{3,80}$/),
  amount: z.number().positive().max(10000000).refine(
    (value) => Number(value.toFixed(2)) === value,
    "Amount must have at most two decimal places",
  ),
  currency: z.enum(["INR"]),
  status: z.enum(["PENDING", "SUCCESS", "FAILED"]),
});
const openapi = {
  openapi: "3.0.3",
  info: { title: "Cloud-Native Payment Soundbox API", version: "1.0.0" },
  paths: {
    "/health": { get: { responses: { "200": { description: "Healthy" } } } },
    "/api/v1/payments/notify": {
      post: {
        summary: "Submit signed payment event",
        responses: {
          "200": { description: "Published" },
          "401": { description: "Invalid signature" },
        },
      },
    },
  },
};
export function createApp(repo: Repository, publisher: PaymentPublisher) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet(),
    cors({ origin: env.CORS_ORIGINS.split(",") }),
    express.json({ limit: "64kb" }),
    correlation,
    pinoHttp({
      logger,
      customProps: (_req, res) => ({ correlationId: res.locals.correlationId }),
    }),
    rateLimit({
      windowMs: 60000,
      limit: 200,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  if (!client.register.getSingleMetric("process_cpu_user_seconds_total")) {
    client.collectDefaultMetrics();
  }
  app.get("/health", (_q, r) => r.json({ status: "UP" }));
  app.get("/ready", async (_q, r) => {
    try {
      await repo.ping();
      r.json({ status: "READY" });
    } catch {
      r.status(503).json({ status: "NOT_READY" });
    }
  });
  app.get("/metrics", async (_q, r) => {
    r.type(client.register.contentType).send(await client.register.metrics());
  });
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapi));
  app.post("/api/v1/merchants", adminAuth, async (req, res, next) => {
    try {
      res
        .status(201)
        .json(await repo.createMerchant(merchantSchema.parse(req.body)));
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/v1/merchants", adminAuth, async (req, res, next) => {
    try {
      res.json(
        await repo.listMerchants(page(req.query.page), limit(req.query.limit)),
      );
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/v1/merchants/:id", adminAuth, async (req, res, next) => {
    try {
      const x = await repo.getMerchant(String(req.params.id));
      if (!x) return res.status(404).json({ message: "Merchant not found" });
      res.json(x);
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/v1/devices/register", adminAuth, async (req, res, next) => {
    try {
      const v = deviceSchema.parse(req.body);
      if (!(await repo.getMerchant(v.merchantId)))
        return res.status(404).json({ message: "Merchant not found" });
      res
        .status(201)
        .json(
          await repo.createDevice({
            ...v,
            status: "ACTIVE",
            firmwareVersion: "1.0.0",
            lastSeenAt: null,
          }),
        );
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/v1/devices/:id", adminAuth, async (req, res, next) => {
    try {
      const d = await repo.getDevice(String(req.params.id));
      if (!d) return res.status(404).json({ message: "Device not found" });
      res.json({ ...d, merchant: await repo.getMerchant(d.merchantId) });
    } catch (e) {
      next(e);
    }
  });
  app.patch(
    "/api/v1/devices/:id/language",
    adminAuth,
    async (req, res, next) => {
      try {
        const { language } = z
          .object({ language: z.enum(languages) })
          .parse(req.body);
        const d = await repo.updateDevice(String(req.params.id), { language });
        if (!d) return res.status(404).json({ message: "Device not found" });
        res.json(d);
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch("/api/v1/devices/:id/status", adminAuth, async (req, res, next) => {
    try {
      const { status } = z
        .object({
          status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "OFFLINE"]),
        })
        .parse(req.body);
      const d = await repo.updateDevice(String(req.params.id), { status });
      if (!d) return res.status(404).json({ message: "Device not found" });
      res.json(d);
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/v1/payments/notify", hmacAuth, async (req, res, next) => {
    try {
      const v = paymentSchema.parse(req.body);
      const m = await repo.getMerchantByCode(v.merchantCode);
      if (!m) return res.status(404).json({ message: "Merchant not found" });
      const duplicate = (old: Awaited<ReturnType<Repository["createTransaction"]>>) => {
        if (old.merchantId !== m.id || old.amount !== v.amount ||
            old.currency !== v.currency || old.paymentStatus !== v.status) {
          return res.status(409).json({ message: "Transaction reference conflicts with an existing payment" });
        }
        return res.json({ ...old, idempotent: true });
      };
      const old = await repo.getTransactionByReference(v.transactionReference);
      if (old) return duplicate(old);
      if (m.status !== "ACTIVE")
        return res.status(409).json({ message: "Merchant is not active" });
      const d = await repo.findActiveDevice(m.id);
      if (!d)
        return res.status(409).json({ message: "No active soundbox device" });
      let t;
      try {
        t = await repo.createTransaction({
          transactionReference: v.transactionReference,
          merchantId: m.id,
          deviceId: d.id,
          amount: v.amount,
          currency: v.currency,
          paymentStatus: v.status,
          announcementStatus: "PENDING",
        });
      } catch (error) {
        // PostgreSQL uniqueness serializes racing requests. Only the winner publishes.
        if ((error as { code?: string }).code === "23505") {
          const winner = await repo.getTransactionByReference(v.transactionReference);
          if (winner) return duplicate(winner);
        }
        throw error;
      }
      if (v.status === "SUCCESS") {
        await publisher.publish(d.deviceCode, paymentMessage(t, d));
        await repo.updateAnnouncement(t.id, "PUBLISHED");
        t = { ...t, announcementStatus: "PUBLISHED" };
      }
      res.status(201).json({ ...t, idempotent: false });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/v1/transactions", adminAuth, async (req, res, next) => {
    try {
      res.json(
        await repo.listTransactions(
          {
            merchantId: s(req.query.merchantId),
            deviceId: s(req.query.deviceId),
            status: s(req.query.status),
            from: s(req.query.from),
            to: s(req.query.to),
          },
          page(req.query.page),
          limit(req.query.limit),
        ),
      );
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/v1/transactions/:id", adminAuth, async (req, res, next) => {
    try {
      const t = await repo.getTransaction(String(req.params.id));
      if (!t) return res.status(404).json({ message: "Transaction not found" });
      res.json(t);
    } catch (e) {
      next(e);
    }
  });
  app.post(
    "/api/v1/transactions/:id/replay",
    adminAuth,
    async (req, res, next) => {
      try {
        const t = await repo.getTransaction(String(req.params.id));
        if (!t)
          return res.status(404).json({ message: "Transaction not found" });
        if (t.paymentStatus !== "SUCCESS")
          return res
            .status(409)
            .json({ message: "Only successful payments can be replayed" });
        const d = await repo.getDevice(t.deviceId);
        if (!d || d.status !== "ACTIVE")
          return res
            .status(409)
            .json({ message: "Associated device is not active" });
        const msg = paymentMessage(t, d);
        await publisher.publish(d.deviceCode, msg);
        const event = await repo.addEvent({
          deviceId: d.id,
          eventType: "PAYMENT_REPLAYED",
          payload: { transactionId: t.id, eventId: msg.eventId },
        });
        res.json({ transaction: t, replayEvent: event });
      } catch (e) {
        next(e);
      }
    },
  );
  app.use((_q, r) => r.status(404).json({ message: "Route not found" }));
  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof ZodError)
      err = Object.assign(
        new Error(err.issues.map((x) => x.message).join(", ")),
        { status: 400 },
      );
    errors(err, req, res, next);
  });
  return app;
}
const s = (v: unknown) => (typeof v === "string" ? v : undefined),
  p = (v: unknown) => Math.max(1, Number(v) || 1),
  page = p,
  limit = (v: unknown) => Math.min(100, p(v) || 20);
