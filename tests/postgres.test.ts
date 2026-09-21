import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { PostgresRepository } from '../src/repositories/postgres.js';
import { signPayment } from '../src/security/payment-signing.js';
import { env } from '../src/config/env.js';
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('real PostgreSQL acceptance', () => {
  let repo: PostgresRepository;
  let admin: pg.Pool;
  const schema = 'soundbox_test_' + randomUUID().replaceAll('-', '');
  beforeAll(async () => {
    const connection = new URL(url!);
    if (!connection.pathname.slice(1).startsWith('soundbox_test')) throw new Error('TEST_DATABASE_URL must target a soundbox_test database');
    admin = new pg.Pool({ connectionString: url });
    await admin.query(`CREATE SCHEMA ${schema}`);
    connection.searchParams.set('options', `-c search_path=${schema},public`);
    repo = new PostgresRepository(connection.toString());
    await repo.pool.query(await readFile('migrations/001_init.sql', 'utf8'));
  });
  afterAll(async () => { await repo?.close(); await admin?.end(); });
  // Retain the uniquely named test schema for inspection. Never touch application tables.
  async function fixture() {
    const suffix = randomUUID().slice(0, 8);
    const merchant = await repo.createMerchant({ merchantCode: `SHOP-${suffix}`, merchantName: '123.45', status: 'ACTIVE' });
    const device = await repo.createDevice({ merchantId: merchant.id, deviceCode: `DEVICE-${suffix}`, serialNumber: `SERIAL-${suffix}`, language: 'en', status: 'ACTIVE', firmwareVersion: '1.20', lastSeenAt: null });
    const publish = vi.fn().mockResolvedValue(undefined);
    const app = createApp(repo, { publish });
    const body = { merchantCode: merchant.merchantCode, transactionReference: `TXN-${suffix}`, amount: 0.29, currency: 'INR', status: 'SUCCESS' };
    const send = (value = body) => request(app).post('/api/v1/payments/notify').set('X-Soundbox-Signature', signPayment(value, env.PAYMENT_HMAC_SECRET)).send(value);
    return { merchant, device, publish, body, send };
  }
  it('preserves numeric-looking text fields while returning a numeric amount', async () => {
    const f = await fixture();
    expect(f.merchant.merchantName).toBe('123.45');
    expect(f.device.firmwareVersion).toBe('1.20');
    const accepted = await f.send();
    expect(accepted.status).toBe(201);
    expect(accepted.body.amount).toBe(0.29);
  });
  it('resolves simultaneous unique inserts to one row and one normal publication', async () => {
    const f = await fixture();
    const results = await Promise.all(Array.from({ length: 20 }, () => f.send()));
    expect(results.filter(r => r.status === 201)).toHaveLength(1);
    expect(results.filter(r => r.status === 200)).toHaveLength(19);
    expect(new Set(results.map(r => r.body.id)).size).toBe(1);
    expect(f.publish).toHaveBeenCalledOnce();
    const count = await repo.pool.query('SELECT count(*)::int AS n FROM transactions WHERE transaction_reference=$1', [f.body.transactionReference]);
    expect(count.rows[0].n).toBe(1);
    expect((await f.send({ ...f.body, amount: 12.50 })).status).toBe(409);
    expect(f.publish).toHaveBeenCalledOnce();
  }, 30000);
});
