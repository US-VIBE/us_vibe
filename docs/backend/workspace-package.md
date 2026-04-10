# Backend workspace package (`@us-vibe/backend`)

## Purpose

Domain logic, TypeORM entities, data-source configuration, and Redis helpers live in [`src/backend`](../../src/backend) as an npm workspace package. [`apps/api`](../../apps/api) remains the HTTP adapter (NestJS controllers and module wiring).

## Layout

- `src/backend/package.json` — package name `@us-vibe/backend`, build emits `dist/`.
- `src/backend/src/index.ts` — public exports consumed by the API app.

## Build and link

From the repository root:

```bash
npm install
npm run build -w @us-vibe/backend
npm run build -w api
```

The root `npm run build` builds `@us-vibe/backend` before `web` and `api` so the API always compiles against a fresh `dist/` of the backend package.

## Smoke wiring

`GET /health` returns `service: us-vibe-api+<label>` where `<label>` comes from `getBackendPackageLabel()` in `@us-vibe/backend`, proving the workspace dependency resolves at compile and runtime.
