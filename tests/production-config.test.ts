import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseEnvironment } from '../src/config/env.js';
const config = () => ({ NODE_ENV: 'production', JWT_SECRET: randomBytes(32).toString('hex'), PAYMENT_HMAC_SECRET: randomBytes(32).toString('hex'), ENCRYPTION_KEY_BASE64: randomBytes(32).toString('base64'), DATABASE_URL: 'postgresql://service:synthetic-test-password@database/test' });
describe('production configuration', () => {
  it('rejects implicit development credentials', () => expect(() => parseEnvironment({ NODE_ENV: 'production' })).toThrow('JWT_SECRET'));
  it('accepts explicit production configuration', () => expect(parseEnvironment(config()).NODE_ENV).toBe('production'));
  it.each(['JWT_SECRET', 'PAYMENT_HMAC_SECRET', 'ENCRYPTION_KEY_BASE64', 'DATABASE_URL'])('requires %s', name => {
    const input: Record<string, string> = config(); delete input[name];
    expect(() => parseEnvironment(input)).toThrow(name);
  });
  it.each(['AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', 'replace-with-32-random-bytes-as-base64', 'invalid'])('rejects unusable encryption key %s', key => expect(() => parseEnvironment({ ...config(), ENCRYPTION_KEY_BASE64: key })).toThrow('ENCRYPTION_KEY_BASE64'));
  it('rejects example secrets', () => expect(() => parseEnvironment({ ...config(), JWT_SECRET: 'replace-with-at-least-32-random-characters' })).toThrow('JWT_SECRET'));
});
