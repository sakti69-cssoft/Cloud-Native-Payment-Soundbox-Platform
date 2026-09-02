# Troubleshooting
- `/ready` 503: verify `DATABASE_URL`, database health, and migration status.
- No announcement: verify the active device, topic/device code, broker health, HMAC, and simulator subscription.
- 401 payment: sign the exact serialized body; whitespace changes alter the signature.
- 409 payment: check device status or uniqueness constraints.
- Reset local data intentionally with `docker compose down -v` (destructive to the local development volume).
