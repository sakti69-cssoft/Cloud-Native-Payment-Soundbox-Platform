import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mqtt from 'mqtt';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { signPayment } from '../src/security/payment-signing.js';

const base = process.env.API_BASE_URL || 'http://localhost:3000';
const db = new pg.Pool({ connectionString: env.DATABASE_URL });
const observer = mqtt.connect(env.MQTT_URL, { connectTimeout: 5000, reconnectPeriod: 0 });
const ref = `RECOVERY-${randomUUID()}`;
const messages: any[] = [];
observer.on('message', (_topic, data) => {
  const message = JSON.parse(data.toString());
  if (message.transactionReference === ref) messages.push(message);
});
const token = jwt.sign({ sub: 'local-validation' }, env.JWT_SECRET, { expiresIn: '5m' });
async function call(path: string, body?: unknown, signature?: string, admin = false) {
  return fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(signature ? { 'X-Soundbox-Signature': signature } : {}), ...(admin ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
}
async function waitForCount(count: number) {
  const deadline = Date.now() + 10000;
  while (messages.length < count && Date.now() < deadline) await new Promise(r => setTimeout(r, 100));
  assert.equal(messages.length, count, 'MQTT publication count');
}
try {
  await new Promise<void>((resolve, reject) => {
    observer.once('error', reject);
    observer.once('connect', () => resolve());
  });
  await observer.subscribeAsync('soundbox/SBOX-DEMO-001/payment', { qos: 1 });
  assert.equal((await call('/health')).status, 200);
  assert.equal((await call('/ready')).status, 200);
  const body = { merchantCode: 'SHOP-DEMO-001', transactionReference: ref, amount: 500, currency: 'INR', status: 'SUCCESS' };
  const response = await call('/api/v1/payments/notify', body, signPayment(body, env.PAYMENT_HMAC_SECRET));
  assert.equal(response.status, 201);
  const transaction = await response.json() as any;
  await waitForCount(1);
  assert.equal(messages[0].amount, 500);
  const stored = await db.query('SELECT * FROM transactions WHERE transaction_reference=$1', [ref]);
  assert.equal(stored.rowCount, 1);
  assert.equal(stored.rows[0].announcement_status, 'PUBLISHED');
  const duplicate = await call('/api/v1/payments/notify', body, signPayment(body, env.PAYMENT_HMAC_SECRET));
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json() as any).idempotent, true);
  await new Promise(r => setTimeout(r, 500));
  assert.equal(messages.length, 1);
  const replay = await call(`/api/v1/transactions/${transaction.id}/replay`, {}, undefined, true);
  assert.equal(replay.status, 200);
  await waitForCount(2);
  assert.notEqual(messages[0].eventId, messages[1].eventId);
  const events = await db.query("SELECT * FROM device_events WHERE payload->>'transactionId'=$1 AND event_type='PAYMENT_REPLAYED'", [transaction.id]);
  assert.equal(events.rowCount, 1);
  assert.equal((await call('/api/v1/payments/notify', body, 'invalid')).status, 401);
  const invalid = { ...body, transactionReference: `INVALID-${randomUUID()}`, amount: -1 };
  assert.equal((await call('/api/v1/payments/notify', invalid, signPayment(invalid, env.PAYMENT_HMAC_SECRET))).status, 400);
  assert.equal((await call('/api/v1/transactions')).status, 401);
  assert.equal((await call(`/api/v1/transactions/${transaction.id}`, undefined, undefined, true)).status, 200);
  console.log(JSON.stringify({ result: 'PASS', transactionReference: ref, transactionId: transaction.id, checks: ['health', 'readiness', 'signed payment', 'PostgreSQL persistence', 'MQTT receipt', 'idempotency', 'replay', 'replay audit event', 'invalid signature', 'invalid amount', 'management authentication'] }, null, 2));
} finally {
  await observer.endAsync(true);
  await db.end();
}
