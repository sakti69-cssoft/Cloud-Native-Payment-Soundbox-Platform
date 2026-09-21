import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { MemoryRepository } from '../src/repositories/memory.js';
import { env } from '../src/config/env.js';
import { signPayment } from '../src/security/payment-signing.js';

async function fixture() {
  const repo = new MemoryRepository();
  const merchant = await repo.createMerchant({ merchantCode: 'SHOP-ONE', merchantName: 'Synthetic shop', status: 'ACTIVE' });
  await repo.createDevice({ merchantId: merchant.id, deviceCode: 'DEVICE-ONE', serialNumber: 'SERIAL-ONE', language: 'en', status: 'ACTIVE', firmwareVersion: '1', lastSeenAt: null });
  const publish = vi.fn().mockResolvedValue(undefined);
  const app = createApp(repo, { publish });
  const body = { merchantCode: 'SHOP-ONE', transactionReference: 'TXN-RETRY', amount: 0.29, currency: 'INR', status: 'SUCCESS' };
  const send = (value = body) => request(app).post('/api/v1/payments/notify').set('X-Soundbox-Signature', signPayment(value, env.PAYMENT_HMAC_SECRET)).send(value);
  return { repo, merchant, publish, body, send };
}

describe('payment acceptance regressions', () => {
  it.each([{ amount: 20 }, { status: 'FAILED' }, { merchantCode: 'SHOP-TWO' }])('rejects conflicting retry %j without disclosing the original payment', async (change) => {
    const f = await fixture();
    await f.repo.createMerchant({ merchantCode: 'SHOP-TWO', merchantName: 'Other shop', status: 'ACTIVE' });
    expect((await f.send()).status).toBe(201);
    const result = await f.send({ ...f.body, ...change });
    expect(result.status).toBe(409);
    expect(result.body).not.toHaveProperty('id');
    expect(f.publish).toHaveBeenCalledOnce();
  });
  it('returns one identity when requests race at the unique insert', async () => {
    const f = await fixture();
    const original = f.repo.getTransactionByReference.bind(f.repo);
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    vi.spyOn(f.repo, 'getTransactionByReference').mockImplementation(async ref => {
      if (++arrivals <= 8) {
        if (arrivals === 8) release();
        await barrier;
        return null;
      }
      return original(ref);
    });
    const results = await Promise.all(Array.from({ length: 8 }, () => f.send()));
    expect(results.filter(r => r.status === 201)).toHaveLength(1);
    expect(results.filter(r => r.status === 200)).toHaveLength(7);
    expect(new Set(results.map(r => r.body.id)).size).toBe(1);
    expect(f.repo.transactions).toHaveLength(1);
    expect(f.publish).toHaveBeenCalledOnce();
  });
  it.each([1.005, 0.001, 500.123])('rejects fractional minor units %s before persistence', async amount => {
    const f = await fixture();
    expect((await f.send({ ...f.body, amount })).status).toBe(400);
    expect(f.repo.transactions).toHaveLength(0);
    expect(f.publish).not.toHaveBeenCalled();
  });
  it('rejects new payments for inactive merchants', async () => {
    const f = await fixture(); f.merchant.status = 'INACTIVE';
    expect((await f.send()).status).toBe(409);
    expect(f.repo.transactions).toHaveLength(0);
  });
  it('preserves existing payment lookup after merchant deactivation', async () => {
    const f = await fixture(); const first = await f.send(); f.merchant.status = 'INACTIVE';
    const retry = await f.send();
    expect(retry.status).toBe(200); expect(retry.body.id).toBe(first.body.id);
    expect(f.publish).toHaveBeenCalledOnce();
  });
});
