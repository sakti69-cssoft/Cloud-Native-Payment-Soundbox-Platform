# Security

Production startup rejects absent, short, development or example JWT and payment HMAC secrets. Both signing secrets must be explicitly supplied with at least 32 characters. The encryption key must be canonical base64 for 32 bytes and cannot be the all-zero example key. Production also requires an explicit database URL without example credentials. These checks reject known unsafe defaults but do not measure entropy; generate independent secrets with a cryptographic random generator and store them privately. Local development defaults remain demonstration-only.

The security workflow pins Trivy action v0.36.0 to its verified commit rather than the unavailable `0.33.1` tag. Repository and image scans still fail on fixable HIGH and CRITICAL findings. A successful action download alone does not establish a clean scan.
Payment webhook signatures use HMAC-SHA256 over recursively key-sorted canonical JSON. This makes signatures independent of whitespace and property ordering while still detecting any field-value change; verification remains timing-safe.

Management APIs use JWT bearer authentication; the simulated provider uses HMAC-SHA256. Secrets come from environment variables through a SecretManager boundary; a Google adapter can be implemented without changing domain services. Logs redact credentials and signatures. AES-256-GCM helpers provide confidentiality and integrity for an example sensitive configuration value, with a 32-byte environment key. This is defense-in-depth, not a banking compliance claim.
