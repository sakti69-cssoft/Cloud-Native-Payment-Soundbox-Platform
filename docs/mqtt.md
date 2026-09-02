# MQTT
Devices subscribe to `soundbox/{deviceCode}/payment`. JSON contains only an event ID, transaction reference, amount, currency, language, and display message. QoS 1 can redeliver, so real devices should deduplicate `eventId`. Anonymous access is local-only; production requires TLS, authentication, per-device ACLs, rotation, and broker monitoring.
