import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { MemoryRepository } from '../src/repositories/memory.js';
import { encrypt, decrypt } from '../src/security/crypto.js';
import { env } from '../src/config/env.js';
import { signPayment } from '../src/security/payment-signing.js';

async function fixture() {
  const repo = new MemoryRepository();
  const publish = vi.fn().mockResolvedValue(undefined);
  const app = createApp(repo, { publish });
  const token = jwt.sign({ sub: 'admin' }, env.JWT_SECRET);
  const auth = { Authorization: `Bearer ${token}` };
  const merchant = await repo.createMerchant({ merchantCode: 'SHOP-DEMO-001', merchantName: 'Demo', status: 'ACTIVE' });
  const device = await repo.createDevice({ merchantId: merchant.id, deviceCode: 'SBOX-DEMO-001', serialNumber: 'SERIAL-001', language: 'en', status: 'ACTIVE', firmwareVersion: '1.0.0', lastSeenAt: null });
  return { repo, app, auth, merchant, device };
}

describe('additional platform behavior', () => {
  it('reports readiness when repository is reachable', async () => { const { app } = await fixture(); expect((await request(app).get('/ready')).body.status).toBe('READY'); });
  it('returns device details with merchant', async () => { const { app, auth, device } = await fixture(); const r = await request(app).get(`/api/v1/devices/${device.id}`).set(auth); expect(r.body.merchant.merchantCode).toBe('SHOP-DEMO-001'); });
  it('updates device status safely', async () => { const { app, auth, device } = await fixture(); const r = await request(app).patch(`/api/v1/devices/${device.id}/status`).set(auth).send({ status: 'SUSPENDED' }); expect(r.body.status).toBe('SUSPENDED'); });
  it('returns an individual persisted transaction', async () => { const { repo, app, auth, merchant, device } = await fixture(); const t = await repo.createTransaction({ transactionReference: 'TXN-DETAIL-1', merchantId: merchant.id, deviceId: device.id, amount: 42, currency: 'INR', paymentStatus: 'SUCCESS', announcementStatus: 'PUBLISHED' }); const r = await request(app).get(`/api/v1/transactions/${t.id}`).set(auth); expect(r.body.transactionReference).toBe('TXN-DETAIL-1'); });
  it('round-trips authenticated AES-256-GCM encryption', () => { const key = Buffer.alloc(32, 7); const ciphertext = encrypt('synthetic-sensitive-value', key); expect(ciphertext).not.toContain('synthetic-sensitive-value'); expect(decrypt(ciphertext, key)).toBe('synthetic-sensitive-value'); });
  it('accepts a correctly computed HMAC', async () => { const { app } = await fixture(); const body = { merchantCode: 'SHOP-DEMO-001', transactionReference: 'TXN-HMAC-1', amount: 10, currency: 'INR', status: 'SUCCESS' }; const signature = signPayment(body, env.PAYMENT_HMAC_SECRET); expect((await request(app).post('/api/v1/payments/notify').set('X-Soundbox-Signature', signature).send(body)).status).toBe(201); });
});
