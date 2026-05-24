# FlowForge Issues — Fresh Graduate Edition

Kumpulan **111 GitHub issue siap-upload** untuk implementasi FlowForge dengan scope yang sudah disesuaikan untuk **fresh graduate** (baru lulus, belum punya pengalaman produksi besar).

## Cara Upload ke GitHub

1. Buka repo GitHub kamu → tab Issues → New Issue.
2. Untuk setiap file `EPIC-XX-NN-*.md`:
   - Title issue: ambil dari heading `# [Epic-XX] ...` di file
   - Body: copy semua isi file di bawah heading
3. Tambahkan **Labels** sesuai header masing-masing issue (epic-XX, area-XXX, dst.)
4. Setelah semua issue dibuat, edit body untuk replace placeholder `#N` di "Depends on" dengan issue number GitHub yang sebenarnya.
5. Pakai GitHub Project (board) untuk visualisasi progress.

> 💡 **Tip**: Pakai [`gh` CLI](https://cli.github.com/) untuk batch upload. Contoh script:
> ```bash
> for f in issues/EPIC-*.md; do
>   title=$(head -1 "$f" | sed 's/^# //')
>   gh issue create --title "$title" --body-file "$f" --label "epic-$(echo $f | grep -oE 'EPIC-[0-9]+')"
> done
> ```

## Yang Berbeda dari Spec Asli

Untuk akomodasi level fresh grad, hal-hal berikut **disederhanakan** dari design dokumen aslinya:

| Aspek | Spec Asli | Versi Fresh Grad |
|-------|-----------|------------------|
| Script sandbox | Docker per-step + Firecracker MicroVM | `child_process` Node.js dengan timeout (best-effort) |
| Log Store | ClickHouse + S3 Glacier tier | PostgreSQL `logs` table dengan partition by date |
| Multi-replica orchestrator | Partitioning by `run_id` | Single replica + `FOR UPDATE` lock |
| Property-based testing | `fast-check` 100+ iterasi per property | Table-based tests dengan input/expected lengkap |
| JWT algoritma | RS256 (asymmetric) | HS256 (symmetric, lebih simpel) |
| Cloud manifest | Terraform module sketch | Hanya `docker-compose.yml` + dokumentasi |
| GraphQL | Bonus endpoint | Skip — REST only |
| Retention tier hot/warm/cold | Otomatis | Manual cleanup script (`DELETE older than 30 days`) |
| Webhook secret | Encrypted at rest | Plaintext di DB (with WARNING) |
| Token budget tracking AI | Required | Stretch goal |

Bagian-bagian advanced ditandai `stretch` di label issue masing-masing dan boleh di-skip kalau deadline ketat.

## Stack Pilihan

- **Backend**: TypeScript + Node.js 20 + Fastify
- **Frontend**: React + Vite + TypeScript
- **DB**: PostgreSQL 15
- **Broker / Cache / Rate limit**: Redis 7 (Streams untuk broker)
- **DB driver**: `pg` + `node-pg-migrate` untuk migrations
- **Validation**: `zod`
- **Auth**: `jsonwebtoken` (HS256) + `argon2`
- **WebSocket**: `ws`
- **Testing**: `vitest` + `supertest` + `nock`

## Rangkuman per Epic

| Epic | Topik | Issues | Estimasi |
|------|-------|--------|----------|
| 01 | Foundation & Tooling | 8 | 1-2 hari |
| 02 | Data Layer (migrations + repository) | 15 | 2-3 hari |
| 03 | DAG Parser | 11 | 2 hari |
| 04 | Backoff & Retry | 2 | 0.5 hari |
| 05 | Auth & RBAC & Rate Limit | 10 | 2-3 hari |
| 06 | API Workflow CRUD | 9 | 2 hari |
| 07 | Run Management API + Broker | 5 | 1-2 hari |
| 08 | Orchestrator (Single-Replica) | 7 | 3 hari |
| 09 | Worker (Basic Sandbox) | 8 | 2-3 hari |
| 10 | Scheduler | 4 | 1 hari |
| 11 | Webhook | 2 | 0.5 hari |
| 12 | Realtime WebSocket | 6 | 2 hari |
| 13 | AI Gateway (Optional) | 5 | 1-2 hari |
| 14 | Frontend Dashboard | 8 | 3-4 hari |
| 15 | Infra & DevOps | 6 | 1-2 hari |
| 16 | Testing & Documentation | 5 | 2 hari |
| **Total** | | **111** | **~25-35 hari kerja** |

Kalau pakai pair programming + code review aktif, bisa dipotong ~30%.

## Saran Eksekusi

### Fase 1: Walking Skeleton (3-4 hari)
Selesaikan minimal vertikal slice agar end-to-end working sebelum lanjut:

1. Epic 01 — Foundation
2. Epic 02-02, 02-09, 02-10, 02-11, 02-12 — DB + tenant + user
3. Epic 05-01, 05-02, 05-03, 05-04, 05-06 — Auth + login
4. Epic 06-01 — API health endpoint

→ Sampai sini: bisa login, dapat token, hit `/health`. Konfirmasi flow dasar.

### Fase 2: Core CRUD (3-4 hari)
5. Epic 02-03 (workflows migration), 02-13 (workflow repo)
6. Epic 03 — Parser (paling tidak validate + parse)
7. Epic 06-02, 06-03, 06-04 — workflow CRUD

→ Sampai sini: bisa create/list/get workflow. Test tenant isolation (Epic 05-07).

### Fase 3: Run Execution (5-6 hari)
8. Epic 07 — broker + trigger run
9. Epic 04 — backoff
10. Epic 08 — orchestrator (single replica)
11. Epic 09-01 sampai 09-04 — worker basic (HTTP, DELAY, CONDITIONAL)

→ Sampai sini: workflow sederhana bisa dijalankan end-to-end via curl.

### Fase 4: Real-time + Frontend (4-5 hari)
12. Epic 12 — WebSocket
13. Epic 14-01, 14-02, 14-03, 14-04, 14-05, 14-06 — login page, list, detail, run view

→ Sampai sini: full UX dasar.

### Fase 5: Polish & Stretch (3-5 hari)
14. Epic 10 — scheduler
15. Epic 11 — webhook
16. Epic 09-05, 09-06, 09-07, 09-08 — script step, retry, logs
17. Epic 15 — docker-compose lengkap
18. Epic 16 — README, REVIEW, e2e test
19. (Stretch) Epic 13 — AI

## Daftar Lengkap Issue

### Epic 01: Foundation & Tooling
- `EPIC-01-01-init-monorepo.md`
- `EPIC-01-02-typescript-config.md`
- `EPIC-01-03-eslint-prettier.md`
- `EPIC-01-04-vitest-setup.md`
- `EPIC-01-05-docker-compose-base.md`
- `EPIC-01-06-shared-config-loader.md`
- `EPIC-01-07-logger-utility.md`
- `EPIC-01-08-github-actions-ci.md`

### Epic 02: Data Layer
- `EPIC-02-01-migration-runner-setup.md`
- `EPIC-02-02-migration-tenants-users.md`
- `EPIC-02-03-migration-workflows.md`
- `EPIC-02-04-migration-runs.md`
- `EPIC-02-05-migration-schedules.md`
- `EPIC-02-06-migration-logs.md`
- `EPIC-02-07-migration-audit-log.md`
- `EPIC-02-08-migration-processed-events.md`
- `EPIC-02-09-shared-types.md`
- `EPIC-02-10-database-client.md`
- `EPIC-02-11-tenant-repo.md`
- `EPIC-02-12-user-repo.md`
- `EPIC-02-13-workflow-repo.md`
- `EPIC-02-14-rollback-workflow.md`
- `EPIC-02-14b-run-repo.md`

### Epic 03: DAG Parser
- `EPIC-03-01-parser-package-setup.md`
- `EPIC-03-02-validation-result-types.md`
- `EPIC-03-03-validate-dag-kahn.md`
- `EPIC-03-04-parse-json-yaml.md`
- `EPIC-03-05-serialize-pretty-print.md`
- `EPIC-03-06-compute-ready-set.md`
- `EPIC-03-07-step-config-schemas.md`
- `EPIC-03-08-parser-cli-tool.md` *(stretch)*
- `EPIC-03-09-error-taxonomy-tests.md`
- `EPIC-03-10-detect-cycles-detail.md` *(stretch)*
- `EPIC-03-11-roundtrip-table-test.md`

### Epic 04: Backoff & Retry
- `EPIC-04-01-compute-backoff.md`
- `EPIC-04-02-backoff-property-test.md`

### Epic 05: Auth & RBAC & Rate Limit
- `EPIC-05-01-auth-package-setup.md`
- `EPIC-05-02-password-hash.md`
- `EPIC-05-03-jwt-sign-verify.md`
- `EPIC-05-04-fastify-auth-plugin.md`
- `EPIC-05-05-rate-limiter.md`
- `EPIC-05-06-auth-login-endpoint.md`
- `EPIC-05-07-tenant-isolation-tests.md`
- `EPIC-05-08-payload-size-limit.md`
- `EPIC-05-09-auth-test-helpers.md`
- `EPIC-05-10-tls-note.md`

### Epic 06: API Workflow CRUD
- `EPIC-06-01-fastify-app-skeleton.md`
- `EPIC-06-02-workflow-create-endpoint.md`
- `EPIC-06-03-workflow-get-endpoint.md`
- `EPIC-06-04-workflow-list-endpoint.md`
- `EPIC-06-05-workflow-update-endpoint.md`
- `EPIC-06-06-workflow-rollback-endpoint.md`
- `EPIC-06-07-workflow-delete-endpoint.md`
- `EPIC-06-08-audit-log-repo.md`
- `EPIC-06-09-rate-limit-on-routes.md`

### Epic 07: Run Management + Broker
- `EPIC-07-01-redis-broker-setup.md`
- `EPIC-07-02-trigger-run-endpoint.md`
- `EPIC-07-03-list-runs-endpoint.md`
- `EPIC-07-04-cancel-run-endpoint.md`
- `EPIC-07-05-list-step-runs-endpoint.md`

### Epic 08: Orchestrator
- `EPIC-08-01-orchestrator-skeleton.md`
- `EPIC-08-02-start-run-function.md`
- `EPIC-08-03-step-completion-handler.md`
- `EPIC-08-04-step-event-loop.md`
- `EPIC-08-05-timeout-scanner.md`
- `EPIC-08-06-cancel-handling.md`
- `EPIC-08-07-orchestrator-e2e-test.md`

### Epic 09: Worker
- `EPIC-09-01-worker-skeleton.md`
- `EPIC-09-02-http-step-handler.md`
- `EPIC-09-03-delay-step-handler.md`
- `EPIC-09-04-conditional-step-handler.md`
- `EPIC-09-05-script-step-handler.md`
- `EPIC-09-06-retry-with-backoff.md`
- `EPIC-09-07-write-logs.md`
- `EPIC-09-08-get-run-logs-endpoint.md`

### Epic 10: Scheduler
- `EPIC-10-01-scheduler-package-setup.md`
- `EPIC-10-02-scheduler-tick.md`
- `EPIC-10-03-schedule-repo.md`
- `EPIC-10-04-schedule-crud-endpoints.md`

### Epic 11: Webhook
- `EPIC-11-01-webhook-secret-management.md`
- `EPIC-11-02-webhook-receiver.md`

### Epic 12: Realtime WebSocket
- `EPIC-12-01-realtime-package-setup.md`
- `EPIC-12-02-subscription-manager.md`
- `EPIC-12-03-redis-pubsub-bridge.md`
- `EPIC-12-04-subscribe-message-handling.md`
- `EPIC-12-05-heartbeat.md`
- `EPIC-12-06-realtime-integration-test.md`

### Epic 13: AI Gateway *(stretch goal)*
- `EPIC-13-01-ai-package-setup.md`
- `EPIC-13-02-llm-prompt-builder.md`
- `EPIC-13-03-generate-workflow-endpoint.md`
- `EPIC-13-04-token-budget.md`
- `EPIC-13-05-pii-redaction.md`

### Epic 14: Frontend Dashboard
- `EPIC-14-01-react-vite-setup.md`
- `EPIC-14-02-login-page.md`
- `EPIC-14-03-api-client-helper.md`
- `EPIC-14-04-workflow-list-page.md`
- `EPIC-14-05-workflow-detail-create.md`
- `EPIC-14-06-run-detail-with-websocket.md`
- `EPIC-14-07-dag-visualization.md` *(stretch)*
- `EPIC-14-08-global-health-panel.md` *(stretch)*

### Epic 15: Infra & DevOps
- `EPIC-15-01-dev-script-orchestration.md`
- `EPIC-15-02-multi-stage-dockerfile.md`
- `EPIC-15-03-docker-compose-full.md`
- `EPIC-15-04-prometheus-metrics.md` *(stretch)*
- `EPIC-15-05-cleanup-old-logs-cron.md` *(stretch)*
- `EPIC-15-06-seed-script.md`

### Epic 16: Testing & Documentation
- `EPIC-16-01-e2e-test.md`
- `EPIC-16-02-readme-setup-guide.md`
- `EPIC-16-03-coverage-report.md`
- `EPIC-16-04-review-md-exercise.md`
- `EPIC-16-05-architecture-doc.md`

## Convention untuk Tiap Issue

Setiap file issue mengikuti template berikut:

```markdown
# [Epic-XX] Judul Singkat

**Labels**: `epic-XX`, `good-first-issue` | `intermediate`, `area-XXX`, `stretch?`
**Estimate**: X jam
**Depends on**: None | #N

## Context
Penjelasan kenapa task ini dibutuhkan.

## Acceptance Criteria
- [ ] Kriteria 1 yang testable
- [ ] Kriteria 2

## Implementation Hints
Code snippet atau pseudocode untuk panduan.

## Files Involved
Daftar file yang akan dibuat/diubah.

## How to Verify
Perintah / steps untuk verifikasi manual.
```

## Note tentang Dependency Numbering

Issue body menyebut placeholder seperti `#1`, `#5`, `#42`. Ini berdasarkan urutan ideal pengerjaan, bukan GitHub issue number. Setelah upload, replace dengan issue number GitHub aktual.

Mapping placeholder ke file:
- #1 → EPIC-01-01
- #2 → EPIC-01-02
- #3 → EPIC-01-03
- #4 → EPIC-01-04
- #5 → EPIC-01-05
- #6 → EPIC-01-06
- #9 → EPIC-02-01
- #10 → EPIC-02-02
- #11 → EPIC-02-03
- #12 → EPIC-02-04
- #13 → EPIC-02-05
- #14 → EPIC-02-06
- #15 → EPIC-02-07
- #16 → EPIC-02-09
- #17 → EPIC-02-10
- #18 → EPIC-02-11
- #19 → EPIC-02-12
- #20 → EPIC-02-13
- #21 → EPIC-02-14
- #22 → EPIC-02-14b
- #24 → EPIC-03-01
- #25 → EPIC-03-02
- #26 → EPIC-03-03
- #27 → EPIC-03-04
- #28 → EPIC-03-04 (parser)
- #29 → EPIC-03-05
- #36 → EPIC-04-01
- #38 → EPIC-05-01
- #40 → EPIC-05-03 (jwt)
- #41 → EPIC-05-04 (auth plugin)
- #42 → EPIC-05-05 (rate limiter)
- #43 → EPIC-05-06 (login)
- #50 → EPIC-06-02 (workflow create)
- #56 → EPIC-07-01 (broker)
- #58 → EPIC-07-03 (list runs)
- #63 → EPIC-08-01 (orch skeleton)
- #64 → EPIC-08-02 (start run)
- #65 → EPIC-08-03 (step handler)
- #66 → EPIC-08-04 (event loop)
- #71 → EPIC-09-01 (worker skeleton)
- #80 → EPIC-09-07 (write logs)
- #82 → EPIC-10-02 (scheduler tick)
- #83 → EPIC-10-03 (schedule repo)
- #87 → EPIC-11-01 (webhook secret)
- #89 → EPIC-12-01 (realtime setup)
- #90 → EPIC-12-02 (subscription manager)
- #91 → EPIC-12-03 (pubsub bridge)
- #92 → EPIC-12-04 (subscribe handling)
- #98 → EPIC-13-01 (ai setup)
- #99 → EPIC-13-02 (prompt builder)
- #100 → EPIC-13-04 (budget)
- #101 → EPIC-13-05 (PII)
- #103 → EPIC-14-01 (React setup)
- #105 → EPIC-14-03 (API client)
- #109 → EPIC-15-02 (Dockerfile)

## Konfirmasi Akhir

Total issue: **111** (kecuali README ini).
Total estimasi: **~25-35 hari kerja fresh grad full-time** untuk semua non-stretch.
Dengan stretch goals: **~40-50 hari**.

Selamat ngerjain! 🚀
