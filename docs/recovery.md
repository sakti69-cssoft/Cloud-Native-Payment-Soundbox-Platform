# Soundbox recovery — 15 September 2026

## Recovered source and intent

Remote: https://github.com/sakti69-cssoft/Cloud-Native-Payment-Soundbox-Platform.git

Recovered revision: `7d5a5d1ba4d11a2ba2538dc9a268088f20a6c017` (`Fix reproducible Soundbox AWS bootstrap`). Local recovery branch: `codex/soundbox-recovery`.

The source was cloned with Git history, not recreated from a generic template. Context was retrieved from the conversations **FinPay Project Status** and **Deploy Soundbox Azure**. Neither returned attached project files. The repository supplies the exact implementation; the illustrative folder tree in the conversation was not the actual tree.

This is a synthetic backend/DevOps portfolio project. Signed REST payment event → TypeScript API → PostgreSQL → Mosquitto MQTT → text Soundbox simulator. JWT protects management APIs. There is no frontend, real payment processor, audio playback, or device delivery acknowledgement. MQTT PUBACK establishes broker acceptance, not device playback.

## Actual folder structure

| Path | Purpose |
|---|---|
| `src/app.ts`, `src/server.ts` | Express API and startup/shutdown |
| `src/config/` | Environment, logs, migration and demo seed |
| `src/repositories/` | PostgreSQL and in-memory test repositories |
| `src/mqtt/`, `src/messaging/` | MQTT publisher and optional consumer scaffold |
| `src/security/`, `src/middleware/` | HMAC, JWT, encryption and HTTP controls |
| `simulator/` | Text device simulator |
| `migrations/001_init.sql` | Merchants, devices, transactions, device events |
| `mosquitto/mosquitto.conf` | Internal development MQTT broker |
| `tests/` | HTTP and payment-signing tests |
| `scripts/` | Signing, local initialization, stack verification |
| `compose.yaml`, `Dockerfile` | Local containers and multi-stage image |
| `compose.prod.yaml`, `nginx/` | Existing VM deployment configuration |
| `terraform/` | Existing AWS infrastructure; not Azure Terraform |
| `.github/workflows/` | CI and security scanning |
| `postman/`, `load-tests/`, `docs/` | API collection, k6 and documentation |

## Configuration and data

`.env.example` and `.env.production.example` were recovered. A new ignored `.env` was generated with fresh JWT, HMAC and encryption secrets. Old `.env.production`, cloud credentials, Terraform state and old database volumes are not present in the clone and were not recovered. Never substitute new local secrets into an existing deployment without a deliberate migration.

Local PostgreSQL: `postgres:5432`, database/user `soundbox`, development-only password from Compose. It has no host port. MQTT: `mosquitto:1883`, host `127.0.0.1:1883`. API: `127.0.0.1:3001` on this laptop because Windows reserves port 3000; it still listens on 3000 inside the container. Topic: `soundbox/SBOX-DEMO-001/payment`, QoS 1. PostgreSQL persists in a named volume. The SQL initialization runs only on an empty volume; changing SQL does not migrate an existing database.

## Run on this laptop

From the repository folder in PowerShell:

```powershell
node scripts/init-local.mjs
npm.cmd ci
npm.cmd run lint
npm.cmd test -- --maxWorkers=1 --no-file-parallelism
npm.cmd run build
docker compose up -d --build --wait --wait-timeout 180
docker compose exec -T soundbox-api node dist/scripts/verify-stack.js
docker compose logs --tail 40 soundbox-simulator
```

The single-worker test option reduces memory pressure while Docker Desktop starts. The simulator health check reports an active MQTT subscription; it is not a payment acknowledgement.

For persistence validation, record the verification command's transaction reference, restart only this stack with `docker compose restart`, wait for health, and query that reference with `docker compose exec -T postgres psql -U soundbox -d soundbox`. Do not remove volumes. `docker compose stop` safely stops this project.

## Historical cloud evidence

The recovered conversation contains a previous user-supplied AWS validation report for this exact commit on EC2 `i-00759e44316d2c460`, type `t3.small`: HTTP health/readiness 200, signed INR 500 payment, one database row, MQTT simulator output, duplicate suppression, authenticated replay, audit event, and volume persistence. It reported only port 80 publicly accessible and no infrastructure replacement. This is historical evidence, not a fresh check of the current AWS account or endpoint.

The later Azure conversation stopped after Azure CLI installation. Its intended target was Azure VM + Docker Compose + Nginx. No verified Azure deployment, Azure Terraform state, or cloud database backup was recovered.

## Validation on the recovered laptop

- Dependency installation from the recovered lockfile: passed.
- ESLint and TypeScript compilation: passed, including the new stack verification script.
- Vitest: 22 tests passed across 3 files with a single worker. The first parallel run hit a worker IPC failure under memory pressure.
- Local Compose configuration validation: passed.
- Docker Desktop initially failed to connect to its Linux engine while the 8 GB laptop was low on memory. Temporarily disabling local Kubernetes and restarting Docker resolved it. Kubernetes was restored to its original enabled setting after validation.
- Local stack build/start: passed. PostgreSQL, Mosquitto, API, and simulator were healthy. Windows reserved port 3000, so the local API uses loopback port 3001.
- Live end-to-end verification: passed on 15 September 2026. Signed INR 500 payment, PostgreSQL row, MQTT receipt, duplicate suppression, replay, replay audit event, invalid signature, invalid amount, and management authentication passed. Reference `RECOVERY-586c2682-a73b-42d6-86f5-7b589fb36cb8` remained after restarting the containers.
- Dependency audit: 9 moderate findings across the complete dependency tree; runtime findings involve the optional Google adapter dependency chain. No dependency upgrades were silently forced. A fresh security scan remains required before public deployment.
- The local stack was stopped after validation with `docker compose down`; its named PostgreSQL volume was preserved. No cloud infrastructure was changed.

## Deployment commands

The existing production Compose file can be tested on a Linux VM. Create a separate `.env.production` from its example with unique runtime secrets and matching database URL/password. Use both `--env-file` (Compose substitutions) and the service environment file:

```sh
chmod 600 .env.production
docker compose --env-file .env.production -f compose.prod.yaml config --quiet
docker compose --env-file .env.production -f compose.prod.yaml up -d --build --wait
docker compose --env-file .env.production -f compose.prod.yaml exec -T soundbox-api node dist/scripts/verify-stack.js
```

Before updating an existing AWS installation, inspect its state and back up its database; preserve its environment file and named volume. For a new Azure deployment, identify subscription, region, VM size, public hostname and access method before provisioning. Expose only the reverse proxy and restrict administration; keep database and MQTT private. The recovered configuration serves HTTP only. Public production use still needs HTTPS, broker authentication/ACLs where devices connect, backup/restore validation, and durable delivery handling.

The original implementation has no transactional outbox: a broker failure after insertion may leave a payment pending. Sequential duplicate handling is covered; concurrent duplicate requests may return conflict from the unique constraint. These are explicit limitations of the preserved portfolio scope, not claims of production payment reliability.
