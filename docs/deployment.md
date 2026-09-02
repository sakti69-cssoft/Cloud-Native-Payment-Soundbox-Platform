# Deployment
Compose runs PostgreSQL, Mosquitto, the non-root API, and a simulator with health checks. Copy `.env.example` to `.env`, replace every placeholder, build, wait for health, and seed synthetic development data. Production must use managed secrets, TLS, broker ACLs, durable event delivery, backups, migrations as a release job, and least-privilege networking.
