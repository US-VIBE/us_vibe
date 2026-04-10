# Backend cross-team handshake (B / A / C / D)

This document records **defaults and open decisions** so B (Core) work stays aligned with the role charter without re-negotiating basics every sprint.

## SSOT (ProjectState)

- **Sprint default**: [.ai/project-state.md](../../.ai/project-state.md) remains the authoritative SSOT surface for product metadata (`approvedRequirements`, `currentApiSpecs`, `openQuestions`, …).
- **Database SSOT**: deferred until A defines write ownership, optimistic concurrency, and which fields must be queryable from SQL. Until then, APIs focus on **collaboration logs and auth**, not duplicating SSOT in Postgres.

## OpenAPI versions

- **Canonical contract**: [`specs/openapi/v1.yaml`](../../specs/openapi/v1.yaml) (also referenced in `.ai/project-state.md`).
- **v1.1 draft**: [`specs/openapi/v1.1.yaml`](../../specs/openapi/v1.1.yaml) is treated as a **non-binding candidate** until Gate B explicitly promotes it (B proposes → C/D impact → A routing approval → SSOT update).

## CI default branch

- GitHub Actions workflow [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs `npm ci` and `npm run build` on pushes and pull requests targeting **`main` and `develop`**, matching the branch rule in [`docs/team-role-charter.md`](../team-role-charter.md).

## Local infrastructure ownership

- **Compose file**: [`docker-compose.yml`](../../docker-compose.yml) at the repo root provides **PostgreSQL** and **Redis** for local development. B documents connection URLs in backend docs; D may extend the same compose for CI services later.
- **Environment template**: [`.env.example`](../../.env.example) lists `DATABASE_URL`, `JWT_SECRET`, and `REDIS_URL` without secrets.

## Contract change flow (reminder)

Per the charter: **B proposes** OpenAPI and data-model updates → **C/D** comment on consumer and pipeline impact → **A** records approval routing in SSOT → B implements in `specs/**`, `@us-vibe/backend`, and `apps/api`.
