# API Contract Summary

## Version
- current: v1

## Endpoints
- `GET /health`

## Response Policy
- success: `{ ok: boolean, service: string }`
- error: `{ code: string, message: string }`
