# API
Swagger UI is served at `/api-docs`. List endpoints return `{items,page,limit,total}` and cap pages at 100. Transaction filters are `merchantId`, `deviceId`, `status`, `from`, and `to` (ISO timestamps). Errors include timestamp, HTTP status, error, safe message, path, and correlation ID.
