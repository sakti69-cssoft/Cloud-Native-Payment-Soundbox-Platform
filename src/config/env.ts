import 'dotenv/config'; import {z} from 'zod';
const schema=z.object({NODE_ENV:z.enum(['development','test','production']).default('development'),PORT:z.coerce.number().default(3000),DATABASE_URL:z.string().default('postgresql://soundbox:soundbox-local-only@localhost:5432/soundbox'),MQTT_URL:z.string().default('mqtt://localhost:1883'),JWT_SECRET:z.string().min(16).default('development-jwt-secret-change-me'),PAYMENT_HMAC_SECRET:z.string().min(16).default('development-hmac-secret-change-me'),ENCRYPTION_KEY_BASE64:z.string().default('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='),CORS_ORIGINS:z.string().default('http://localhost:3000'),LOG_LEVEL:z.string().default('info')});
export function parseEnvironment(input: Record<string, string | undefined>) {
  const config = schema.parse(input);
  if (config.NODE_ENV === 'production') {
    for (const name of ['JWT_SECRET', 'PAYMENT_HMAC_SECRET'] as const) {
      const value = input[name];
      if (!value || value.length < 32 || /^(development-|replace-with-)/i.test(value)) {
        throw new Error(`${name} must be explicitly configured with a random production secret of at least 32 characters`);
      }
    }
    const key = input.ENCRYPTION_KEY_BASE64;
    if (!key || !/^[A-Za-z0-9+/]{43}=$/.test(key) ||
        Buffer.from(key, 'base64').length !== 32 ||
        Buffer.from(key, 'base64').toString('base64') !== key ||
        Buffer.from(key, 'base64').every((byte) => byte === 0)) {
      throw new Error('ENCRYPTION_KEY_BASE64 must be explicitly configured with 32 random bytes encoded as base64');
    }
    if (!input.DATABASE_URL || /soundbox-local-only|replace-with-/i.test(input.DATABASE_URL)) {
      throw new Error('DATABASE_URL must be explicitly configured for production');
    }
  }
  return config;
}
export const env = parseEnvironment(process.env);
