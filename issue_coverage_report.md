# FlowForge Issue Coverage Report (1–111)

> **Audit Date**: 2026-05-24
> **Method**: Full code read of all packages, migrations, tests, frontend, CI, Docker, and documentation files + git log review of all 93 commits across 48 PRs.

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | **DONE** — Acceptance criteria met |
| ⚠️ | **PARTIAL** — Implemented but missing some acceptance criteria |
| ❌ | **MISSING** — Not implemented or only a stub |

---

## Summary

| Epic | Topic | Issues | ✅ Done | ⚠️ Partial | ❌ Missing |
|------|-------|--------|---------|------------|-----------|
| 01 | Foundation & Tooling | 8 | 7 | 1 | 0 |
| 02 | Data Layer | 15 | 14 | 1 | 0 |
| 03 | DAG Parser | 11 | 11 | 0 | 0 |
| 04 | Backoff & Retry | 2 | 2 | 0 | 0 |
| 05 | Auth & RBAC & Rate Limit | 10 | 10 | 0 | 0 |
| 06 | API Workflow CRUD | 9 | 9 | 0 | 0 |
| 07 | Run Management + Broker | 5 | 5 | 0 | 0 |
| 08 | Orchestrator | 7 | 5 | 1 | 1 |
| 09 | Worker | 8 | 7 | 1 | 0 |
| 10 | Scheduler | 4 | 4 | 0 | 0 |
| 11 | Webhook | 2 | 2 | 0 | 0 |
| 12 | Realtime WebSocket | 6 | 5 | 1 | 0 |
| 13 | AI Gateway *(stretch)* | 5 | 5 | 0 | 0 |
| 14 | Frontend Dashboard | 8 | 8 | 0 | 0 |
| 15 | Infra & DevOps | 6 | 5 | 1 | 0 |
| 16 | Testing & Documentation | 5 | 5 | 0 | 0 |
| **Total** | | **111** | **104** | **6** | **1** |

---

## Detailed Analysis Per Issue

### Epic 01: Foundation & Tooling

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 1 | [EPIC-01-01](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-01-01-init-monorepo.md) Init Monorepo | ✅ | pnpm workspaces configured with all 10 packages (api, orchestrator, worker, scheduler, realtime, parser, auth, shared, ai-gateway, log-store). Root `package.json` has build/test/lint scripts. PR #112 |
| 2 | [EPIC-01-02](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-01-02-typescript-config.md) TypeScript Config | ✅ | [tsconfig.base.json](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/tsconfig.base.json) with `strict: true`. PR #114 |
| 3 | [EPIC-01-03](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-01-03-eslint-prettier.md) ESLint & Prettier | ⚠️ | [eslint.config.js](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/eslint.config.js) + [.prettierrc.json](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/.prettierrc.json) present. **Missing**: custom ESLint rule rejecting SQL queries without `tenant_id` predicate (mentioned in issue acceptance criteria) |
| 4 | [EPIC-01-04](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-01-04-vitest-setup.md) Vitest Setup | ✅ | [vitest.config.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/vitest.config.ts) configured with coverage. Sample test exists. PR #116 |
| 5 | [EPIC-01-05](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-01-05-docker-compose-base.md) Docker Compose Base | ✅ | [docker-compose.yml](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/docker-compose.yml) with postgres:15 + redis:7 + healthchecks + volumes. PR #117 |
| 6 | [EPIC-01-06](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-01-06-shared-config-loader.md) Config Loader | ✅ | [config.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/shared/src/config.ts) with Zod validation, `.env.example` exists. PR #118 |
| 7 | [EPIC-01-07](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-01-07-logger-utility.md) Logger Utility | ✅ | [logger.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/shared/src/logger.ts) with pino + pino-pretty. PR #119 |
| 8 | [EPIC-01-08](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-01-08-github-actions-ci.md) GitHub Actions CI | ✅ | [ci.yml](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/.github/workflows/ci.yml) with typecheck, lint, test:coverage, build. PR #120 |

---

### Epic 02: Data Layer

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 9 | [EPIC-02-01](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-02-01-migration-runner-setup.md) Migration Runner | ✅ | node-pg-migrate configured. Scripts: migrate, migrate:up, migrate:down, migrate:create. PR #121 |
| 10 | [EPIC-02-02](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-02-02-migration-tenants-users.md) Tenants/Users Migration | ✅ | [001_tenants_users.js](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/migrations/001_tenants_users.js). Test exists. PR #122 |
| 11 | [EPIC-02-03](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-02-03-migration-workflows.md) Workflows Migration | ✅ | [002_workflows.js](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/migrations/002_workflows.js). Test exists. PR #123 |
| 12 | [EPIC-02-04](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-02-04-migration-runs.md) Runs Migration | ✅ | [003_runs.js](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/migrations/003_runs.js). Test exists. PR #124 |
| 13 | [EPIC-02-05](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-02-05-migration-schedules.md) Schedules Migration | ✅ | [004_schedules.js](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/migrations/004_schedules.js). Test exists. PR #125 |
| 14 | [EPIC-02-06](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-02-06-migration-logs.md) Logs Migration | ✅ | [005_logs.js](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/migrations/005_logs.js). Test exists. PR #125 |
| 15 | [EPIC-02-07](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-02-07-migration-audit-log.md) Audit Log Migration | ✅ | [006_audit_logs.js](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/migrations/006_audit_logs.js). Test exists. PR #125 |
| 16 | [EPIC-02-08](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-02-08-migration-processed-events.md) Processed Events Migration | ✅ | [007_processed_events.js](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/migrations/007_processed_events.js). Test exists. PR #125 |
| 17 | [EPIC-02-09](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-02-09-shared-types.md) Shared Types | ✅ | Full schemas: [tenant.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/shared/src/schemas/tenant.ts), [user.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/shared/src/schemas/user.ts), [workflow.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/shared/src/schemas/workflow.ts), [run.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/shared/src/schemas/run.ts) with Zod validators. PR #126 |
| 18 | [EPIC-02-10](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-02-10-database-client.md) Database Client | ✅ | [db.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/shared/src/db.ts) — Pool wrapper, `withTransaction` helper, graceful shutdown. PR #127 |
| 19 | [EPIC-02-11](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-02-11-tenant-repo.md) Tenant Repo | ✅ | [tenant.repo.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/repos/tenant.repo.ts) with create/getBySlug/getById. Test exists. PR #128 |
| 20 | [EPIC-02-12](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-02-12-user-repo.md) User Repo | ✅ | [user.repo.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/repos/user.repo.ts) with create/findByEmail/findForLogin. Test exists. PR #129 |
| 21 | [EPIC-02-13](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-02-13-workflow-repo.md) Workflow Repo | ✅ | [workflow.repo.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/repos/workflow.repo.ts) with CRUD + versioning in transaction. Test exists. PR #130 |
| 22 | [EPIC-02-14](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-02-14-rollback-workflow.md) Rollback Workflow | ✅ | `rollbackWorkflow` function in workflow.repo.ts. Creates new version from target. PR #152 |
| 23 | [EPIC-02-14b](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-02-14b-run-repo.md) Run Repo | ⚠️ | [run.repo.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/repos/run.repo.ts) + [step-run.repo.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/repos/step-run.repo.ts). FSM transitions with `IllegalStateTransitionError`. **Partial**: Step-run FSM transitions (PENDING→READY→RUNNING→terminal) are done inline in worker, not via a dedicated repo function with validations |

---

### Epic 03: DAG Parser

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 24 | [EPIC-03-01](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-03-01-parser-package-setup.md) Parser Package Setup | ✅ | `@flowforge/parser` package with index.ts exporting all modules. PR #115 |
| 25 | [EPIC-03-02](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-03-02-validation-result-types.md) Validation Types | ✅ | [types.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/parser/src/types.ts) with `ValidationResult`, `ValidationError`, `ValidationIssue` |
| 26 | [EPIC-03-03](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-03-03-validate-dag-kahn.md) DAG Validation (Kahn's) | ✅ | [validate.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/parser/src/validate.ts) — duplicate ID, dangling deps, cycle detection via Kahn's. Tests pass |
| 27 | [EPIC-03-04](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-03-04-parse-json-yaml.md) Parse JSON/YAML | ✅ | [parser.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/parser/src/parser.ts) — parseFromJson, parseFromYaml, auto-detect. Size guard (5MB) + step count guard (1000) |
| 28 | [EPIC-03-05](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-03-05-serialize-pretty-print.md) Serialize / Pretty Print | ✅ | [serialize.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/parser/src/serialize.ts) — sorted keys, indent 2, LF endings, JSON + YAML |
| 29 | [EPIC-03-06](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-03-06-compute-ready-set.md) Compute Ready Set | ✅ | [ready-set.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/parser/src/ready-set.ts) — pure function, used by orchestrator |
| 30 | [EPIC-03-07](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-03-07-step-config-schemas.md) Step Config Schemas | ✅ | [step-configs.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/parser/src/step-configs.ts) — HTTP, SCRIPT, DELAY, CONDITIONAL schemas |
| 31 | [EPIC-03-08](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-03-08-parser-cli-tool.md) Parser CLI Tool *(stretch)* | ✅ | [cli.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/parser/src/cli.ts) — `flowforge-validate <path>` |
| 32 | [EPIC-03-09](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-03-09-error-taxonomy-tests.md) Error Taxonomy Tests | ✅ | [error-taxonomy.test.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/parser/src/error-taxonomy.test.ts) — tests for cycle, dangling, duplicate, unknown_step_type, size limits |
| 33 | [EPIC-03-10](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-03-10-detect-cycles-detail.md) Detect Cycles Detail *(stretch)* | ✅ | [detect-cycles.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/parser/src/detect-cycles.ts) — DFS with cycle path reporting |
| 34 | [EPIC-03-11](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-03-11-roundtrip-table-test.md) Roundtrip Table Test | ✅ | [roundtrip.test.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/parser/src/roundtrip.test.ts) — parse→serialize→parse roundtrip, pretty-print idempotence |

---

### Epic 04: Backoff & Retry

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 35 | [EPIC-04-01](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-04-01-compute-backoff.md) Compute Backoff | ✅ | [backoff.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/shared/src/backoff.ts) — exponential + cap + jitter. Tests in backoff.test.ts. PR #132 |
| 36 | [EPIC-04-02](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-04-02-backoff-property-test.md) Backoff Property Test | ✅ | [backoff.property.test.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/shared/src/backoff.property.test.ts) — bounded property tested. PR #133 |

---

### Epic 05: Auth & RBAC & Rate Limit

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 37 | [EPIC-05-01](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-05-01-auth-package-setup.md) Auth Package Setup | ✅ | `@flowforge/auth` with index.ts exporting all. PR #134 |
| 38 | [EPIC-05-02](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-05-02-password-hash.md) Password Hash | ✅ | [password.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/auth/src/password.ts) — argon2id, memory 64MB, iterations 3. Tests exist. PR #135 |
| 39 | [EPIC-05-03](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-05-03-jwt-sign-verify.md) JWT Sign/Verify | ✅ | [jwt.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/auth/src/jwt.ts) — HS256, sign + verify. Tests exist. PR #136 |
| 40 | [EPIC-05-04](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-05-04-fastify-auth-plugin.md) Fastify Auth Plugin | ✅ | [middleware.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/auth/src/middleware.ts) — `authPlugin` (onRequest hook) + `requireRole` with ADMIN>EDITOR>VIEWER hierarchy. Tests exist. PR #137 |
| 41 | [EPIC-05-05](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-05-05-rate-limiter.md) Rate Limiter | ✅ | [rate-limit.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/auth/src/rate-limit.ts) — Redis token bucket, 600/60s default, Retry-After header. Tests exist. PR #139 |
| 42 | [EPIC-05-06](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-05-06-auth-login-endpoint.md) Auth Login Endpoint | ✅ | [auth.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/routes/auth.ts) — POST /auth/login with timing-safe comparison. PR #140 |
| 43 | [EPIC-05-07](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-05-07-tenant-isolation-tests.md) Tenant Isolation Tests | ✅ | [workflow.tenant-isolation.test.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/routes/workflow.tenant-isolation.test.ts). PR #141 |
| 44 | [EPIC-05-08](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-05-08-payload-size-limit.md) Payload Size Limit | ✅ | `bodyLimit: 1024 * 1024` (1MB) in [app.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/app.ts#L30). PR #142 |
| 45 | [EPIC-05-09](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-05-09-auth-test-helpers.md) Auth Test Helpers | ✅ | [auth-helpers.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/test/auth-helpers.ts) + tests. PR #143 |
| 46 | [EPIC-05-10](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-05-10-tls-note.md) TLS Note | ✅ | [TLS.md](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/docs/TLS.md) — reverse proxy strategy documentation with nginx/Caddy/ALB examples. PR #144 |

---

### Epic 06: API Workflow CRUD

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 47 | [EPIC-06-01](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-06-01-fastify-app-skeleton.md) Fastify App Skeleton | ✅ | [app.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/app.ts) — GET /health, /health/db, metrics, graceful shutdown. PR #145 |
| 48 | [EPIC-06-02](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-06-02-workflow-create-endpoint.md) POST /workflows | ✅ | In [workflows.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/routes/workflows.ts#L33) — validates with parser, creates in transaction, audit log. Tests in workflows.create.test.ts. PR #148 |
| 49 | [EPIC-06-03](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-06-03-workflow-get-endpoint.md) GET /workflows/:id | ✅ | In [workflows.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/routes/workflows.ts#L88) — tenant-scoped, supports version query param. Tests exist. PR #149 |
| 50 | [EPIC-06-04](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-06-04-workflow-list-endpoint.md) GET /workflows | ✅ | In [workflows.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/routes/workflows.ts#L68) — pagination, name filter. Tests exist. PR #150 |
| 51 | [EPIC-06-05](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-06-05-workflow-update-endpoint.md) PATCH /workflows/:id | ✅ | In [workflows.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/routes/workflows.ts#L112) — creates new version, audit log. Tests exist. PR #151 |
| 52 | [EPIC-06-06](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-06-06-workflow-rollback-endpoint.md) POST /workflows/:id/rollback | ✅ | In [workflows.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/routes/workflows.ts#L161) — ADMIN only, creates new version from target, audit log. Tests exist. PR #152 |
| 53 | [EPIC-06-07](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-06-07-workflow-delete-endpoint.md) DELETE /workflows/:id | ✅ | In [workflows.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/routes/workflows.ts#L205) — ADMIN only, 204 on success, audit log. Tests exist. PR #153 |
| 54 | [EPIC-06-08](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-06-08-audit-log-repo.md) Audit Log Repo | ✅ | [audit.repo.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/repos/audit.repo.ts) — append-only write + list with pagination. Tests exist. PR #153 |
| 55 | [EPIC-06-09](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-06-09-rate-limit-on-routes.md) Rate Limit on Routes | ✅ | Rate limit middleware applied globally via preHandler in [app.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/app.ts#L49). Test exists at rate-limit.test.ts. PR #153 |

---

### Epic 07: Run Management + Broker

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 56 | [EPIC-07-01](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-07-01-redis-broker-setup.md) Redis Broker Setup | ✅ | [broker.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/shared/src/broker.ts) — RedisStreamBroker with enqueue/dequeue/ack/ensureGroup. Tests exist. PR #153 |
| 57 | [EPIC-07-02](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-07-02-trigger-run-endpoint.md) Trigger Run | ✅ | POST /workflows/:id/runs in [workflows.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/routes/workflows.ts#L230) — 202, enqueue to broker, publish event. Tests exist (runs.trigger.test.ts). PR #153 |
| 58 | [EPIC-07-03](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-07-03-list-runs-endpoint.md) List Runs | ✅ | GET /runs in [runs.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/routes/runs.ts#L26) — pagination, status/date/workflow filter, 30-day guard. Tests exist. PR #153 |
| 59 | [EPIC-07-04](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-07-04-cancel-run-endpoint.md) Cancel Run | ✅ | POST /runs/:id/cancel in [runs.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/routes/runs.ts#L96) — transactional FSM transition, publish event, audit log. PR #153 |
| 60 | [EPIC-07-05](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-07-05-list-step-runs-endpoint.md) List Step Runs | ✅ | GET /runs/:id/steps in [runs.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/routes/runs.ts#L139). PR #153 |

---

### Epic 08: Orchestrator

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 61 | [EPIC-08-01](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-08-01-orchestrator-skeleton.md) Orchestrator Skeleton | ✅ | [index.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/orchestrator/src/index.ts) — dual consumer loop (runs + step events), graceful shutdown, metrics server. PR #154 |
| 62 | [EPIC-08-02](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-08-02-start-run-function.md) Start Run Function | ✅ | [start-run.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/orchestrator/src/start-run.ts) — transactional, SELECT FOR UPDATE, compute ready set, enqueue steps. Tests exist. PR #154 |
| 63 | [EPIC-08-03](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-08-03-step-completion-handler.md) Step Completion Handler | ✅ | [handle-step-event.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/orchestrator/src/handle-step-event.ts) — event dedup via processed_events, FSM transitions, continue_on_failure, compute ready set. Tests exist. PR #154 |
| 64 | [EPIC-08-04](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-08-04-step-event-loop.md) Step Event Loop | ✅ | Integrated in orchestrator index.ts `consumeStepEvents` function — continuous loop consuming from flowforge:step-events. PR #154 |
| 65 | [EPIC-08-05](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-08-05-timeout-scanner.md) Timeout Scanner | ✅ | [timeout-scanner.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/orchestrator/src/timeout-scanner.ts) — periodic scan for runs exceeding timeout_sec, marks TIMED_OUT, publishes event. Tests exist. PR #154 |
| 66 | [EPIC-08-06](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-08-06-cancel-handling.md) Cancel Handling | ⚠️ | Cancel is handled at API level (POST /runs/:id/cancel) which transitions status. Worker checks `CANCELLED` before processing. **Partial**: Orchestrator doesn't actively send cancel signals to worker for in-progress steps — it relies on worker polling |
| 67 | [EPIC-08-07](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-08-07-orchestrator-e2e-test.md) Orchestrator E2E Test | ❌ | [e2e.test.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/orchestrator/src/e2e.test.ts) exists but needs the full stack running (DB + Redis + orchestrator). The test file exists but it's the backend-level `tests/e2e/happy-path.test.ts` that covers the E2E flow instead. **Missing**: Dedicated orchestrator-level E2E test with mock services |

---

### Epic 09: Worker

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 68 | [EPIC-09-01](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-09-01-worker-skeleton.md) Worker Skeleton | ✅ | [worker/index.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/worker/src/index.ts) — consumer loop, step dispatch, heartbeat, graceful shutdown, metrics. PR #155 |
| 69 | [EPIC-09-02](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-09-02-http-step-handler.md) HTTP Step Handler | ✅ | [http.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/worker/src/handlers/http.ts) — fetch with AbortController timeout, response parsing. Tests exist. PR #155 |
| 70 | [EPIC-09-03](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-09-03-delay-step-handler.md) Delay Step Handler | ✅ | [delay.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/worker/src/handlers/delay.ts) — validation + setTimeout. Tests exist. PR #155 |
| 71 | [EPIC-09-04](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-09-04-conditional-step-handler.md) Conditional Step Handler | ✅ | [conditional.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/worker/src/handlers/conditional.ts) — expr-eval (safe, no arbitrary code), builds context from prev step outputs. Tests exist. PR #155 |
| 72 | [EPIC-09-05](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-09-05-script-step-handler.md) Script Step Handler | ✅ | [script.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/worker/src/handlers/script.ts) — child_process with timeout, 100KB output cap, minimal env. Tests exist. PR #155 |
| 73 | [EPIC-09-06](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-09-06-retry-with-backoff.md) Retry with Backoff | ⚠️ | Retry logic exists in [worker/index.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/worker/src/index.ts#L146-L176) — checks max_attempts, uses computeBackoff, re-enqueue with setTimeout delay. **Partial**: Uses `setTimeout` for delay which means if worker crashes during delay, the retry is lost. Not persisted. |
| 74 | [EPIC-09-07](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-09-07-write-logs.md) Write Logs | ✅ | Worker writes start + completion logs via [appendLogs](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/shared/src/logs.ts) to PostgreSQL `logs` table. PR #155 |
| 75 | [EPIC-09-08](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-09-08-get-run-logs-endpoint.md) GET /runs/:id/logs | ✅ | In [runs.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/routes/runs.ts#L160) — pagination, step_id filter, ordered by ts ASC. PR #155 |

---

### Epic 10: Scheduler

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 76 | [EPIC-10-01](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-10-01-scheduler-package-setup.md) Scheduler Package Setup | ✅ | `@flowforge/scheduler` with index.ts + server.ts + tick.ts. PR #155 |
| 77 | [EPIC-10-02](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-10-02-scheduler-tick.md) Scheduler Tick | ✅ | [tick.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/scheduler/src/tick.ts) — `SELECT FOR UPDATE SKIP LOCKED`, computes next_run_at with cron-parser, enqueues to broker. Tests exist. PR #155 |
| 78 | [EPIC-10-03](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-10-03-schedule-repo.md) Schedule Repo | ✅ | [schedule.repo.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/repos/schedule.repo.ts) — CRUD operations. Tests exist. PR #155 |
| 79 | [EPIC-10-04](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-10-04-schedule-crud-endpoints.md) Schedule CRUD Endpoints | ✅ | [schedules.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/routes/schedules.ts) — POST/GET/PATCH/DELETE with cron validation. Tests exist. PR #155 |

---

### Epic 11: Webhook

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 80 | [EPIC-11-01](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-11-01-webhook-secret-management.md) Webhook Secret Mgmt | ✅ | [webhook.repo.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/repos/webhook.repo.ts) — rotate-secret (randomBytes + hash), HMAC-SHA256 compute + verify. Migrations 008+009 for DB column. PR #156 |
| 81 | [EPIC-11-02](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-11-02-webhook-receiver.md) Webhook Receiver | ✅ | [webhooks.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/routes/webhooks.ts) — POST /webhooks/:tenant_slug/:workflow_id with HMAC signature verify, timestamp window (5min), triggers run. Tests exist. PR #156 |

---

### Epic 12: Realtime WebSocket

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 82 | [EPIC-12-01](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-12-01-realtime-package-setup.md) Realtime Package Setup | ✅ | `@flowforge/realtime` with server.ts + subscription-manager.ts. PR #156 |
| 83 | [EPIC-12-02](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-12-02-subscription-manager.md) Subscription Manager | ✅ | [subscription-manager.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/realtime/src/subscription-manager.ts) — register/unregister connections, per-run subscription, tenant-filtered broadcast. Tests exist. PR #156 |
| 84 | [EPIC-12-03](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-12-03-redis-pubsub-bridge.md) Redis Pub/Sub Bridge | ✅ | In [server.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/realtime/src/server.ts#L17-L29) — subscribes to `flowforge:events`, parses and broadcasts. PR #156 |
| 85 | [EPIC-12-04](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-12-04-subscribe-message-handling.md) Subscribe Message Handling | ✅ | In [server.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/realtime/src/server.ts#L83-L109) — subscribe/unsubscribe actions, validates run ownership via DB query. PR #156 |
| 86 | [EPIC-12-05](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-12-05-heartbeat.md) Heartbeat | ✅ | In [server.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/realtime/src/server.ts#L31-L81) — ping every 30s, close if no pong within 60s. PR #156 |
| 87 | [EPIC-12-06](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-12-06-realtime-integration-test.md) Realtime Integration Test | ⚠️ | [integration.test.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/realtime/src/integration.test.ts) exists. **Partial**: Test covers subscribe/unsubscribe/broadcast but may not fully test cross-tenant isolation or heartbeat timeout scenarios end-to-end |

---

### Epic 13: AI Gateway *(stretch goal)*

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 88 | [EPIC-13-01](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-13-01-ai-package-setup.md) AI Package Setup | ✅ | `@flowforge/ai-gateway` with index.ts, prompt.ts, pii.ts, budget.ts. PR #156 |
| 89 | [EPIC-13-02](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-13-02-llm-prompt-builder.md) LLM Prompt Builder | ✅ | [prompt.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/ai-gateway/src/prompt.ts) — system prompt with schema, `<<<USER_REQUEST>>>` delimiter. Tests exist. PR #156 |
| 90 | [EPIC-13-03](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-13-03-generate-workflow-endpoint.md) Generate Workflow Endpoint | ✅ | [ai.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/api/src/routes/ai.ts) — POST /ai/generate-workflow with role check, budget check, PII redaction, 30s timeout, re-prompt loop, SCRIPT rejection, DRAFT output. Tests exist. PR #156 |
| 91 | [EPIC-13-04](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-13-04-token-budget.md) Token Budget | ✅ | [budget.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/ai-gateway/src/budget.ts) — 100K daily limit per tenant, Redis counter with TTL. Tests exist. PR #156 |
| 92 | [EPIC-13-05](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-13-05-pii-redaction.md) PII Redaction | ✅ | [pii.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/ai-gateway/src/pii.ts) — email, phone (Indo+intl), NIK patterns. Tests exist. PR #156 |

---

### Epic 14: Frontend Dashboard

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 93 | [EPIC-14-01](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-14-01-react-vite-setup.md) React Vite Setup | ✅ | [vite.config.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/frontend/vite.config.ts), [index.html](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/frontend/index.html), React + TypeScript. PR #157 |
| 94 | [EPIC-14-02](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-14-02-login-page.md) Login Page | ✅ | [LoginPage.tsx](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/frontend/src/pages/LoginPage.tsx) — tenant_slug + email + password form, localStorage token storage, error handling. PR #157 |
| 95 | [EPIC-14-03](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-14-03-api-client-helper.md) API Client Helper | ✅ | [api.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/frontend/src/lib/api.ts) — auto-attach Bearer token, 401 redirect, ApiError class. [auth.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/frontend/src/lib/auth.ts) — getToken, logout, getClaims. PR #157 |
| 96 | [EPIC-14-04](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-14-04-workflow-list-page.md) Workflow List Page | ✅ | [WorkflowsPage.tsx](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/frontend/src/pages/WorkflowsPage.tsx) — list with search, pagination, create modal. PR #157 |
| 97 | [EPIC-14-05](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-14-05-workflow-detail-create.md) Workflow Detail/Create | ✅ | [WorkflowDetailPage.tsx](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/frontend/src/pages/WorkflowDetailPage.tsx) — JSON editor, trigger run, version display. PR #157 |
| 98 | [EPIC-14-06](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-14-06-run-detail-with-websocket.md) Run Detail + WebSocket | ✅ | [RunDetailPage.tsx](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/frontend/src/pages/RunDetailPage.tsx) — WS subscription, live events, auto-reconnect, step timeline, cancel button, DAG visualization. PR #157 |
| 99 | [EPIC-14-07](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-14-07-dag-visualization.md) DAG Visualization *(stretch)* | ✅ | [DagView.tsx](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/frontend/src/components/DagView.tsx) — ReactFlow-based, topological level layout, status-colored nodes/edges, animated edges for running steps. PR #157 |
| 100 | [EPIC-14-08](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-14-08-global-health-panel.md) Global Health Panel *(stretch)* | ✅ | [HealthPanel.tsx](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/frontend/src/components/HealthPanel.tsx) — active runs, success rate (24h), avg duration. Auto-refresh. Backend: GET /runs/stats endpoint. PR #157 |

---

### Epic 15: Infra & DevOps

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 101 | [EPIC-15-01](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-15-01-dev-script-orchestration.md) Dev Script Orchestration | ✅ | `pnpm dev:all` script, individual service scripts. docker-compose with all services. PR #158 |
| 102 | [EPIC-15-02](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-15-02-multi-stage-dockerfile.md) Multi-Stage Dockerfile | ✅ | [Dockerfile](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/Dockerfile) — builder + runner stages, pnpm, SERVICE env var for service selection. PR #158 |
| 103 | [EPIC-15-03](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-15-03-docker-compose-full.md) Docker Compose Full | ✅ | [docker-compose.yml](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/docker-compose.yml) — all services (api, orchestrator, worker, scheduler, realtime, web, postgres, redis, migrate) with healthchecks. PR #158 |
| 104 | [EPIC-15-04](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-15-04-prometheus-metrics.md) Prometheus Metrics *(stretch)* | ⚠️ | [metrics.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/packages/shared/src/metrics.ts) — prom-client with httpDuration, runsTotal, rateLimitHitTotal, activeRuns. `/metrics` endpoint on API + metrics servers on orchestrator/worker/scheduler/realtime. **Partial**: `rateLimitHitTotal` counter is defined but never incremented anywhere in the rate-limit middleware; `activeRuns` gauge is defined but never updated. |
| 105 | [EPIC-15-05](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-15-05-cleanup-old-logs-cron.md) Cleanup Old Logs *(stretch)* | ✅ | [cleanup-logs.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/scripts/cleanup-logs.ts) — `DELETE FROM logs WHERE ts < now() - interval '30 days'`. PR #158 |
| 106 | [EPIC-15-06](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-15-06-seed-script.md) Seed Script | ✅ | [seed.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/scripts/seed.ts) — creates tenant, admin user, sample workflow. Idempotent. PR #158 |

---

### Epic 16: Testing & Documentation

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 107 | [EPIC-16-01](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-16-01-e2e-test.md) E2E Test | ✅ | [happy-path.test.ts](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/backend/tests/e2e/happy-path.test.ts) — login → create workflow (3 steps) → trigger run → WebSocket subscribe → verify RUN_SUCCEEDED → verify logs. PR #158 |
| 108 | [EPIC-16-02](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-16-02-readme-setup-guide.md) README Setup Guide | ✅ | [README.md](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/README.md) — Quick Start, folder structure, dev/test commands, known limitations. PR #158 |
| 109 | [EPIC-16-03](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-16-03-coverage-report.md) Coverage Report | ✅ | `pnpm test:coverage` configured in vitest.config.ts with thresholds (lines 75%, branches 65%). Coverage dir exists. PR #158 |
| 110 | [EPIC-16-04](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-16-04-review-md-exercise.md) REVIEW.md Exercise | ✅ | [REVIEW.md](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/REVIEW.md) — Code review with SQL injection, tenant scoping, SELECT *, naming, type annotation comments. PR #158 |
| 111 | [EPIC-16-05](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/issues/EPIC-16-05-architecture-doc.md) Architecture Doc | ✅ | [ARCHITECTURE.md](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/docs/ARCHITECTURE.md) — Control/Data/Observability planes, Mermaid diagram, request flow. [TRADEOFFS.md](file:///c:/Users/Ikhda%20Muhammad%20PC/Documents/Coding/sevima-test/docs/TRADEOFFS.md) also exists. PR #158 |

---

## Issues with Partial Coverage — Detail

### 1. EPIC-01-03 (ESLint/Prettier) — ⚠️
The issue asks for a **custom ESLint rule** that rejects SQL queries without `tenant_id`. This rule was never implemented. ESLint + Prettier configs are present and functional but this specific security-related custom rule is missing.

### 2. EPIC-02-14b (Run Repo) — ⚠️
Step-run FSM transitions (PENDING→READY→RUNNING→SUCCEEDED/FAILED/SKIPPED) are done **inline in the worker** via direct SQL queries, not via a dedicated repository function with FSM guard validation. The run-level FSM in `run.repo.ts` is properly guarded, but step-level is not.

### 3. EPIC-08-06 (Cancel Handling) — ⚠️
Cancel sets the run to CANCELLED via the API, and the worker checks for CANCELLED status before processing. However, the orchestrator **does not actively signal** running workers to stop in-progress steps. Currently relies on the worker's next poll cycle to detect the cancellation.

### 4. EPIC-08-07 (Orchestrator E2E Test) — ❌
There's an `e2e.test.ts` file in the orchestrator package but it requires the full infrastructure (DB + Redis). The happy-path E2E test (`tests/e2e/happy-path.test.ts`) covers the end-to-end flow but isn't specifically an orchestrator-isolated E2E test.

### 5. EPIC-09-06 (Retry with Backoff) — ⚠️
Retry logic works correctly using `computeBackoff()` and `setTimeout`, but the retry delay uses an **in-memory setTimeout** which means if the worker crashes during the delay period, the retry is lost and never re-enqueued.

### 6. EPIC-12-06 (Realtime Integration Test) — ⚠️
Integration test exists but may not cover all acceptance criteria like cross-tenant event isolation and heartbeat timeout scenarios comprehensively.

### 7. EPIC-15-04 (Prometheus Metrics) — ⚠️
Metrics definitions exist (counters, histograms, gauges) and `/metrics` endpoints are set up, but some metrics are **never actually incremented** (`rateLimitHitTotal`, `activeRuns` gauge), making them "dead" metrics.

---

## Overall Assessment

**104 out of 111 issues are fully implemented (93.7%)**. 6 issues have partial coverage, and 1 issue (orchestrator E2E test) is effectively missing as a standalone test. The project has excellent overall coverage across all 16 epics including the stretch goals (parser CLI, cycle detection detail, DAG visualization, health panel, AI gateway). The codebase is well-structured with consistent patterns across packages.
