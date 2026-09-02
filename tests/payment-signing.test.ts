import { describe, expect, it } from 'vitest';
import { canonicalJson, signPayment, verifyPaymentSignature } from '../src/security/payment-signing.js';
const secret = 'synthetic-test-secret-at-least-32-chars';
const payment = { merchantCode: 'SHOP-DEMO-001', transactionReference: 'TXN-SIGN-1', amount: 500, currency: 'INR', status: 'SUCCESS' };
describe('canonical payment signing', () => {
  it('is deterministic across key order', () => { const reordered = { status: 'SUCCESS', amount: 500, transactionReference: 'TXN-SIGN-1', currency: 'INR', merchantCode: 'SHOP-DEMO-001' }; expect(canonicalJson(reordered)).toBe(canonicalJson(payment)); expect(signPayment(reordered, secret)).toBe(signPayment(payment, secret)); });
  it('verifies a valid signature', () => expect(verifyPaymentSignature(payment, signPayment(payment, secret), secret)).toBe(true));
  it('rejects a tampered signature', () => expect(verifyPaymentSignature(payment, '00'.repeat(32), secret)).toBe(false));
  it('rejects an altered value', () => expect(verifyPaymentSignature({ ...payment, amount: 501 }, signPayment(payment, secret), secret)).toBe(false));
});
