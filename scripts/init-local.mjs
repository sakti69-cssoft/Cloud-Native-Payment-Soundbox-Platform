import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

if (existsSync('.env')) {
  console.log('Existing .env preserved.');
} else {
  const content = readFileSync('.env.example', 'utf8')
    .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${randomBytes(32).toString('hex')}`)
    .replace(/^PAYMENT_HMAC_SECRET=.*$/m, `PAYMENT_HMAC_SECRET=${randomBytes(32).toString('hex')}`)
    .replace(/^ENCRYPTION_KEY_BASE64=.*$/m, `ENCRYPTION_KEY_BASE64=${randomBytes(32).toString('base64')}`);
  writeFileSync('.env', content, { flag: 'wx', mode: 0o600 });
  console.log('Created .env with fresh local secrets.');
}
