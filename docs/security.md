# Security
Payment webhook signatures use HMAC-SHA256 over recursively key-sorted canonical JSON. This makes signatures independent of whitespace and property ordering while still detecting any field-value change; verification remains timing-safe.

Management APIs use JWT bearer authentication; the simulated provider uses HMAC-SHA256. Secrets come from environment variables through a SecretManager boundary; a Google adapter can be implemented without changing domain services. Logs redact credentials and signatures. AES-256-GCM helpers provide confidentiality and integrity for an example sensitive configuration value, with a 32-byte environment key. This is defense-in-depth, not a banking compliance claim.
