# Architecture
The API separates HTTP orchestration, repository persistence, MQTT publishing, event consumption, and secret retrieval behind narrow interfaces. PostgreSQL is authoritative; MQTT is the device transport. A local consumer is the default. The Google Pub/Sub consumer is deliberately a scaffold so local development never needs cloud credentials.
