# Database
`merchants` own `devices`; transactions reference both; device events provide a replay/audit stream. UUID primary keys, foreign keys, unique merchant/device/serial/transaction identifiers, amount and language checks, enums, timestamps, and lookup/history indexes enforce invariants. The migration and seed use synthetic records only.
