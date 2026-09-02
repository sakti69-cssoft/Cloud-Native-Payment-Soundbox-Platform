import pino from 'pino'; import {env} from './env.js';
export const logger=pino({level:env.LOG_LEVEL,redact:{paths:['req.headers.authorization','req.headers.x-soundbox-signature','*.password','*.secret','*.token','*.key'],censor:'[REDACTED]'}});
