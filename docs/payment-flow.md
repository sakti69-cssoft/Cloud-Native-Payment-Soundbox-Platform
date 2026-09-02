# Payment flow
Before validation, the parsed payment object is encoded as deterministic, recursively key-sorted canonical JSON for HMAC verification. The CLI helper and Postman collection apply the identical algorithm.

The exact request bytes are authenticated with HMAC, then validated. The service resolves the merchant and an active device, checks the globally unique transaction reference, stores the payment, publishes a localized message, and records publication state. A duplicate returns the existing transaction and does not publish. Replay is explicit, authenticated, limited to successful payments on active devices, and audited in `device_events`.
