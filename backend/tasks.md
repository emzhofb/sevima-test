# Implementation Plan: FlowForge

## Overview

Implementasi FlowForge dilakukan secara incremental dengan TypeScript (Node.js + Fastify) untuk Control Plane / Data Plane / Realtime Hub, React + TypeScript untuk dashboard, PostgreSQL sebagai source of truth, Redis untuk cache + rate limit + broker (Streams), dan ClickHouse sebagai Log Store. Urutan tasks mengikuti alur foundation → core engine (parser, retry, orchestrator, worker) → API + auth → realtime → log store → AI gateway → infra → frontend → wiring/E2E. Setiap Correctness Property (P1–P10) di design diturunkan menjadi sub-task property-based test menggunakan `fast-check`, ditempatkan dekat dengan task implementasi yang relevan.

Convert the feature design into a series of prompts for a code-generation LLM that will implement each step with incremental progress. Make sure that each prompt builds on the previous prompts, and ends with wiring things together. There should be no hanging or orphaned code that isn't integrated into a previous step. Focus ONLY on tasks that involve writing, modifying, or testing code.

## Tasks

- [ ] 1. Setup proyek dan tooling foundation
  - [x] 1.1 Inisialisasi monorepo TypeScript + struktur direktori
    - Buat workspaces (`pnpm` / `npm`): `packages/api`, `packages/orchestrator`, `packages/worker`, `packages/scheduler`, `packages/realtime`, `packages/parser`, `packages/auth`, `packages/log-store`, `packages/ai-gateway`, `packages/shared` (tipe + util), `packages/web`
    - Konfigurasi `tsconfig.base.json` dengan `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
    - Tambahkan `package.json` root dengan script `build`, `test`, `lint`, `typecheck`
    - _Requirements: 5.4, 8.6_
  - [ ] 1.2 Setup linter, formatter, dan CI pipeline minimum
    - Konfigurasi ESLint (`@typescript-eslint`) + Prettier dengan rule yang konsisten antar package
    - Tambahkan custom ESLint rule yang menolak query SQL tanpa predikat `tenant_id` pada tabel domain (allow-list comment override)
    - [x] Buat `.github/workflows/ci.yml` dengan jobs `lint`, `typecheck`, `test:unit` (placeholder)
    - _Requirements: 4.5, 8.6, 8.7_
  - [x] 1.3 Setup docker-compose foundation untuk PostgreSQL, Redis, ClickHouse
    - Tulis `docker-compose.yml` dengan service `postgres:15`, `redis:7`, `clickhouse:24-alpine`, masing-masing dengan healthcheck dan volume persistent
    - Tambahkan service `migrate` (one-shot) untuk menjalankan migration script
    - Sediakan `.env.example` dengan seluruh secret/config yang dibutuhkan
    - _Requirements: 5.1, 5.7_
  - [x] 1.4 Setup Vitest test runner
    - `vitest.config.ts` di root
    - Script `pnpm test` jalan walau belum ada test
    - Coverage script `pnpm test:coverage` ada
    - Sample test `packages/shared/src/sample.test.ts` jalan dan pass

- [ ] 2. Data layer dan persistence
  - [ ] 2.1 Definisikan tipe TypeScript untuk seluruh domain entity di `packages/shared`
    - Implementasikan tipe `Tenant`, `User`, `Workflow`, `WorkflowVersion`, `WorkflowDefinition`, `StepSpec`, `RetryPolicy`, `Run`, `StepRun`, `LogEntry`, `Schedule` mengikuti Type Definitions di design
    - Implementasikan validator Zod untuk setiap struktur dengan rule pada Validation Rules (`tenant.slug`, `email`, `max_attempts`, `timeout_sec`, dll.)
    - _Requirements: 1.9, 4.6, 9.3_
  - [ ] 2.2 Implementasikan migration runner dan schema awal PostgreSQL
    - [x] Setup `node-pg-migrate` di root, tambahkan script `migrate`, `migrate:up`, `migrate:down`, `migrate:create`, dan dokumentasi `migrations/README.md`
    - Pakai `node-pg-migrate` atau setara; tulis migration `001_init` membuat tabel `tenants`, `users`, `workflows`, `workflow_versions`, `runs`, `step_runs`, `schedules`, `audit_logs` sesuai ER di design
    - Tambahkan constraint `NOT NULL` pada seluruh kolom `tenant_id`, plus FK + unique constraint (`tenants.slug` global, `users(tenant_id, email)`)
    - Tulis migration `002_indexes` dengan critical indexes: `idx_runs_tenant_started`, `idx_step_runs_run`, `idx_schedules_due`, `idx_workflow_versions_wf`, `idx_workflows_tenant_updated`
    - _Requirements: 4.1, 4.2, 4.6_
  - [ ] 2.3 Implementasikan transactional `createWorkflow` repository
    - Pastikan `INSERT` ke `workflows` + `workflow_versions` (`version = 1`) dilakukan dalam satu transaksi atomic
    - _Requirements: 4.1, 2.7_
  - [ ] 2.4 Implementasikan tenant-scoped repository base + runtime guard
    - Buat helper `withTenantScope(tx, tenantId, query)` yang otomatis menambahkan predikat `tenant_id = $tenantId`
    - Tambahkan runtime assertion + audit log entry ketika query terhadap tabel tenant-scoped dieksekusi tanpa scope (lempar exception, jangan commit)
    - _Requirements: 4.5, 2.1_
  - [ ]* 2.5 Tulis unit tests untuk schema validator + repository scope guard
    - Test `Tenant.slug` regex, `RetryPolicy.max_attempts` boundary, `timeout_sec` boundary
    - Test repository melempar error ketika dipanggil tanpa `tenantId`
    - _Requirements: 1.9, 4.5, 4.6_

- [x] 3. DAG Parser dan validator (`packages/parser`)
  - [x] 3.1 Implementasikan `validateAndSortDAG` dengan Kahn's algorithm
    - Implementasikan deteksi duplicate id, dangling dependency, dan cycle; kembalikan structured error `{ step_id, issue }` dengan taxonomy `cycle | dangling_dependency | duplicate_id | unknown_field | type_mismatch | missing_required | out_of_range | unknown_step_type`
    - Pastikan parser strict mode menolak field tidak dikenal
    - Implementasikan size guard: tolak input > 5 MB atau > 1000 steps dengan error `input_too_large`
    - _Requirements: 1.1, 1.4, 1.9, 9.3, 9.4_
  - [x] 3.2 Implementasikan canonical serializer / pretty-printer JSON dan YAML
    - Sorted keys lexicographic, indent 2 space, UTF-8, LF line ending
    - Pastikan `prettyPrint(parse(prettyPrint(parse(input))))` byte-identical dengan `prettyPrint(parse(input))`
    - _Requirements: 9.1, 9.2_
  - [x] 3.3 Implementasikan `topologicalSort` dan `computeReadySet` sebagai API publik
    - Ekspor sebagai pure function untuk dipakai orchestrator
    - _Requirements: 1.2_
  - [x]* 3.4 Tulis property test untuk Property 2 (DAG Validity)
    - **Property 2: DAG Validity** — `∀ workflow w yang ter-persist: validateAndSortDAG(w.definition).ok = true`
    - Generator: random DAG (mix valid + invalid); assert parser hanya menerima yang `ok = true`
    - **Validates: Requirements 1.1**
  - [x]* 3.5 Tulis property test untuk parser round-trip
    - Generator: `WorkflowDefinition` valid acak; assert `parse(serialize(d, fmt))` ekivalen field-by-field dengan `d` untuk `fmt ∈ { JSON, YAML }`
    - **Validates: Requirements 9.1**
  - [x]* 3.6 Tulis property test untuk pretty-print idempotence
    - Assert `prettyPrint(parse(prettyPrint(parse(input))))` byte-identical dengan `prettyPrint(parse(input))`
    - **Validates: Requirements 9.2**
  - [x]* 3.7 Tulis unit tests untuk error taxonomy dan input limits
    - Test setiap kategori error muncul untuk input yang sesuai (cycle, dangling, duplicate, unknown_step_type, dst.)
    - Test penolakan input > 5 MB dan > 1000 steps
    - _Requirements: 1.4, 1.9, 9.3, 9.4_

- [ ] 4. Backoff dan retry policy (`packages/shared`)
  - [ ] 4.1 Implementasikan `computeBackoff(attempt, policy)` sesuai Algorithm 3
    - Eksponensial dengan cap `policy.backoff_max_ms`, full jitter ketika `policy.jitter = true`
    - Validasi precondition: `attempt >= 1`, `backoff_base_ms > 0`, `backoff_max_ms >= backoff_base_ms`
    - _Requirements: 1.3_
  - [ ]* 4.2 Tulis property test untuk Property 6 (Backoff Bounded)
    - **Property 6: Backoff Bounded** — `∀ attempt a, ∀ policy p: 0 <= computeBackoff(a, p) <= p.backoff_max_ms`
    - **Validates: Requirements 1.3**

- [ ] 5. Checkpoint - Pastikan tests pass
  - Pastikan seluruh test pass, tanyakan ke user jika ada pertanyaan.

- [ ] 6. Orchestrator dan DAG state machine (`packages/orchestrator`)
  - [ ] 6.1 Implementasikan repository untuk `runs` + `step_runs` dengan FSM transition
    - Implementasikan helper transisi yang menolak transisi keluar dari status terminal (`SUCCEEDED | FAILED | CANCELLED | TIMED_OUT`)
    - Pakai `SELECT ... FOR UPDATE` untuk locking saat update state
    - _Requirements: 1.2, 1.7_
  - [ ] 6.2 Implementasikan `advanceRun(runId, event)` event handler idempoten
    - Implementasikan dedup berbasis `event_id` (tabel `processed_events` atau Redis SET with TTL)
    - Implementasikan logika retry → READY, success → SUCCEEDED, failure → FAILED + propagasi ke `runs.status`
    - Emit event lifecycle ke channel realtime (interface, implementasinya di task 12.5)
    - _Requirements: 1.2, 1.6, 1.7, 1.10_
  - [ ] 6.3 Implementasikan `computeReadySet` integration di orchestrator
    - Re-evaluate ready set setelah setiap event, enqueue step yang belum di-enqueue ke broker
    - _Requirements: 1.2_
  - [ ] 6.4 Implementasikan global timeout scanner
    - Periodic job (≤ 1 detik resolution) memeriksa `now() - run.started_at > workflow.timeout_sec`
    - Tandai run `TIMED_OUT` dalam ≤ 5 detik sejak kondisi terpenuhi, kirim cancel signal ke worker, emit `RUN_TIMED_OUT` tepat satu kali
    - _Requirements: 1.5_
  - [ ] 6.5 Implementasikan cancel run flow
    - Endpoint internal `cancelRun(runId, reason)`: hentikan dispatch step baru, tandai `CANCELLED` dalam ≤ 5 detik, emit `RUN_CANCELLED` tepat satu kali
    - _Requirements: 1.8_
  - [ ] 6.6 Implementasikan heartbeat recovery untuk worker crash
    - Worker mengirim heartbeat ke Redis tiap N detik; orchestrator periodically scan `step_runs` dengan `RUNNING` tanpa heartbeat aktif → kembalikan ke `READY` untuk attempt berikutnya
    - Pastikan step `SUCCEEDED` / `SKIPPED` tidak dijalankan ulang
    - _Requirements: 1.11_
  - [ ]* 6.7 Tulis property test untuk Property 3 (Topological Execution)
    - **Property 3: Topological Execution** — `∀ run r, ∀ step s yang transitions ke RUNNING: ∀ d ∈ s.depends_on, ∃ step_run sd dengan sd.status ∈ {SUCCEEDED, SKIPPED} pada t' < t`
    - Generator: DAG valid acak + simulator orchestrator; assert urutan eksekusi menghormati `depends_on`
    - **Validates: Requirements 1.2**
  - [ ]* 6.8 Tulis property test untuk Property 5 (Run Status Monotonicity)
    - **Property 5: Run Status Monotonicity** — Transisi mengikuti FSM `PENDING → RUNNING → terminal` dan status terminal tidak berubah lagi
    - Generator: urutan event acak; assert tidak ada transisi ilegal yang berhasil
    - **Validates: Requirements 1.2**
  - [ ]* 6.9 Tulis property test untuk Property 9 (Idempotency Event Handler)
    - **Property 9: Idempotency** — `applyEvent(e, ..., applyEvent(e, state)) ≡ applyEvent(e, state)`
    - Generator: urutan event dengan duplikat acak; assert state akhir identik dengan state setelah dedup
    - **Validates: Requirements 1.2**
  - [ ]* 6.10 Tulis unit tests untuk FSM edge cases (timeout, cancel, continue_on_failure, recovery)
    - Test transisi terminal, `continue_on_failure = true/false`, recovery worker crash
    - _Requirements: 1.5, 1.6, 1.7, 1.8, 1.11_

- [ ] 7. Worker pool dan step executor (`packages/worker`)
  - [ ] 7.1 Implementasikan worker dispatcher untuk step `HTTP`, `DELAY`, `CONDITIONAL`
    - Konsumsi pesan dari Redis Streams, ambil `step_run`, eksekusi sesuai `step.type`, lapor outcome ke orchestrator
    - Implementasikan timeout per-step
    - _Requirements: 1.4, 5.5_
  - [ ] 7.2 Implementasikan script step sandbox dengan resource limit
    - Eksekusi di Docker container per step (atau Firecracker di prod): CPU ≤ 1 core, memory ≤ 256 MB, timeout default 300 detik (rentang 1–3600), filesystem read-only kecuali `/tmp` (≤ 100 MB), network egress allow-list
    - Hentikan eksekusi dalam ≤ 5 detik bila batas dilanggar dan tandai `FAILED` dengan kategori `resource_violation`
    - _Requirements: 7.1, 7.4_
  - [ ] 7.3 Implementasikan retry orchestration menggunakan `computeBackoff`
    - Setelah failure, tunda re-enqueue dengan delay = `computeBackoff(attempt, policy)`; pastikan total attempt ≤ `max_attempts`
    - _Requirements: 1.3_
  - [ ] 7.4 Implementasikan secret injection per-step via env var
    - Resolve `{{secrets.api_key}}` reference dari Secrets Manager (interface) di scope step saja
    - Bila resolusi gagal: tandai step `FAILED` tanpa mencantumkan path/value secret di error
    - _Requirements: 7.2, 7.3_
  - [ ] 7.5 Implementasikan log redaction layer pada log writer
    - Sebelum tulis ke Log Store, redact value yang match secret pattern → `***REDACTED***`
    - Aktif bahkan pada level `DEBUG`
    - _Requirements: 7.5_
  - [ ]* 7.6 Tulis property test untuk Property 4 (Retry Bounded)
    - **Property 4: Retry Bounded** — `∀ step run sr: sr.attempt <= sr.policy.max_attempts`
    - Generator: urutan failure acak; assert worker tidak pernah menjalankan attempt > `max_attempts`
    - **Validates: Requirements 1.3**
  - [ ]* 7.7 Tulis unit tests untuk sandbox enforcement dan secret handling
    - Test pelanggaran CPU/memory/timeout/network/filesystem menghasilkan `FAILED` dalam ≤ 5 detik
    - Test secret tidak ter-leak di error log saat resolusi gagal
    - _Requirements: 7.1, 7.3, 7.4_

- [ ] 8. Checkpoint - Pastikan tests pass
  - Pastikan seluruh test pass, tanyakan ke user jika ada pertanyaan.

- [ ] 9. Auth, RBAC, dan rate limiter (`packages/auth`)
  - [ ] 9.1 Implementasikan JWT verify (RS256) + request context binding
    - Verify signature, `exp`, `iat`; bind `tenant_id`, `user_id`, `role` ke `RequestContext`
    - Return 401 untuk token tidak ada / malformed / expired / invalid signature
    - _Requirements: 2.3_
  - [ ] 9.2 Implementasikan Argon2id password hashing util
    - Parameter: `memory >= 64 MB`, `iterations >= 3`; provide `hash` + `verify`
    - _Requirements: 2.12_
  - [ ] 9.3 Implementasikan RBAC enforcement middleware
    - Hierarchy `ADMIN > EDITOR > VIEWER`; reject 403 sebelum handler domain dipanggil
    - _Requirements: 2.4_
  - [ ] 9.4 Implementasikan token bucket rate limiter di Redis
    - Default 600 req per 60 detik per `(tenant, route)`, configurable per tenant; key `rl:<tenant_id>:<route>`
    - Return 429 dengan header `Retry-After` 1–60 detik
    - _Requirements: 2.5_
  - [ ] 9.5 Implementasikan TLS guard dan payload size limit
    - Reject koneksi non-TLS atau TLS < 1.3 di edge handler
    - Reject payload > 1 MB dengan 413 sebelum handler domain
    - Pastikan seluruh akses DB pakai parameterized query (lint rule sudah di task 1.2)
    - _Requirements: 7.7, 7.8, 7.9_
  - [ ]* 9.6 Tulis property test untuk Property 1 (Tenant Isolation)
    - **Property 1: Tenant Isolation** — `∀ request r, ∀ row x yang dikembalikan ke r: x.tenant_id = jwt.tenant_id`
    - Generator: dataset dua tenant + request acak dengan JWT tenant A; assert tidak ada baris tenant B yang ter-leak via list, getById, run query, log query
    - **Validates: Requirements 2.1**
  - [ ]* 9.7 Tulis unit tests untuk skenario auth failures
    - Test 401 untuk token absent / malformed / expired / signature invalid; test 403 untuk role mismatch; test 429 saat melebihi kuota; test 413 saat payload > 1 MB
    - _Requirements: 2.3, 2.4, 2.5, 2.12, 7.7, 7.8, 7.9_

- [ ] 10. API Layer (`packages/api`)
  - [ ] 10.1 Implementasikan endpoint Workflow CRUD + versioning
    - `POST /workflows`, `GET /workflows`, `GET /workflows/:id`, `PATCH /workflows/:id` (membuat `WorkflowVersion` baru, tidak memodifikasi versi lama), `DELETE /workflows/:id`
    - Pagination (`page` default 1, `pageSize` 1–100 default 20), filter substring `name`, filter `status`, filter range `created_at`
    - _Requirements: 2.7, 2.11_
  - [ ] 10.2 Implementasikan endpoint `rollbackWorkflow`
    - Hanya `ADMIN`; create versi baru dari `targetVersion`, advance `current_version`; jangan modifikasi versi lama; run yang sedang berjalan tetap pakai `version_id` snapshot
    - _Requirements: 2.8_
  - [ ] 10.3 Implementasikan endpoint `triggerRun` dan `cancelRun`
    - `POST /workflows/:id/runs`: validasi `input` terhadap schema; create `Run` dengan `tenant_id` dari ctx, status `PENDING`; enqueue ke broker; return 202 dengan `run_id` (target p99 < 200 ms pada ≤ 100 concurrent/replica)
    - `POST /runs/:runId/cancel`: panggil orchestrator cancel
    - Return 400 terstruktur untuk input invalid
    - _Requirements: 2.9, 2.10, 1.8_
  - [ ] 10.4 Implementasikan endpoint `getRun`, `listRuns`, `getRunLogs`
    - Pagination default 50, max 200 entries; optional filter `step_id`; tolak range > 30 hari pada `getRunLogs` dengan error indikatif
    - Target p95 ≤ 1 detik
    - _Requirements: 3.6, 3.7_
  - [ ] 10.5 Implementasikan webhook handler `POST /webhooks/:tenant_slug/:workflow_id`
    - Verify HMAC-SHA256 atas body + timestamp dengan secret unik per tenant
    - Reject timestamp di luar window 5 menit; respons 401 generik (tidak membedakan signature vs timestamp)
    - _Requirements: 2.6_
  - [ ] 10.6 Implementasikan audit log writer
    - Tulis entry ke tabel `audit_logs` (append-only) untuk setiap mutasi (workflow create/update/rollback, run trigger, role change, secret access)
    - Field: `tenant_id`, `user_id`, `action`, `resource_id`, `timestamp`, `request_id`; retensi minimal 365 hari
    - _Requirements: 7.6_
  - [ ]* 10.7 Tulis property test untuk Property 10 (Versioning Immutability)
    - **Property 10: Workflow Versioning Immutability** — `∀ versi v yang ter-persist: v.definition immutable`; update selalu menciptakan versi baru
    - Generator: urutan operasi `update` + `rollback` acak; assert tidak ada record `workflow_versions` yang dimodifikasi setelah insert
    - **Validates: Requirements 2.1**
  - [ ]* 10.8 Tulis integration tests untuk API CRUD + RBAC + webhook
    - Test endpoint dengan role berbeda (Admin/Editor/Viewer) → expected status code
    - Test webhook dengan signature valid + invalid + timestamp expired
    - _Requirements: 2.4, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11_

- [ ] 11. Scheduler (`packages/scheduler`)
  - [ ] 11.1 Implementasikan `registerSchedule` / `removeSchedule`
    - Persist ke tabel `schedules`; compute `next_run_at` via `cron-parser` dengan timezone
    - _Requirements: 2.2_
  - [ ] 11.2 Implementasikan `schedulerTick` dengan `SELECT ... FOR UPDATE SKIP LOCKED`
    - Ambil schedules due, trigger run, advance `next_run_at`; aman dijalankan multi-replica
    - _Requirements: 2.2_
  - [ ]* 11.3 Tulis property test untuk Property 7 (At-Most-Once Schedule Trigger)
    - **Property 7: At-Most-Once Schedule Trigger** — `∀ schedule s, ∀ window w: jumlah Run yang dipicu s dengan started_at ∈ w adalah ≤ 1`
    - Generator: simulasi N replica scheduler concurrent + clock acak; assert no double-trigger
    - **Validates: Requirements 2.2**

- [ ] 12. Realtime Hub (`packages/realtime`)
  - [ ] 12.1 Implementasikan WebSocket upgrade + JWT verification
    - Verify JWT via Auth Middleware sebelum subscription diterima
    - Tutup koneksi dengan close code 4401 bila JWT invalid/expired
    - _Requirements: 3.2, 3.3_
  - [ ] 12.2 Implementasikan subscription manager dengan tenant filter
    - Registry koneksi per `tenant_id`; subscribe per `run_id` setelah cek RBAC `VIEWER+`
    - _Requirements: 3.1_
  - [ ] 12.3 Implementasikan heartbeat ping/pong
    - Kirim ping setiap 30 detik; tutup koneksi yang tidak pong dalam 60 detik
    - _Requirements: 3.4_
  - [ ] 12.4 Implementasikan bounded buffer per koneksi + backpressure
    - Buffer 1000 entries; ketika penuh, drop event lama dan kirim snapshot saat bandwidth tersedia
    - Pastikan operasi `emit` di Orchestrator non-blocking dan ≤ 50 ms per event
    - _Requirements: 3.5_
  - [ ] 12.5 Wire orchestrator/worker event emitter ke Realtime Hub
    - Emit `RUN_QUEUED`, `RUN_STARTED`, `STEP_STARTED`, `STEP_SUCCEEDED`, `STEP_FAILED`, `RUN_SUCCEEDED`, `RUN_FAILED`, `RUN_TIMED_OUT`, `RUN_CANCELLED` dengan target latency P95 ≤ 2s, P99 ≤ 5s
    - _Requirements: 3.1_
  - [ ]* 12.6 Tulis property test untuk Property 8 (WebSocket Event Authorization)
    - **Property 8: WebSocket Event Authorization** — `∀ event e yang diterima koneksi c: e.tenant_id = c.tenant_id AND user di c punya akses Viewer+ ke e.run_id`
    - Generator: dataset multi-tenant + event acak; assert tidak ada cross-tenant leak via WS
    - **Validates: Requirements 3.1, 2.1**
  - [ ]* 12.7 Tulis integration test untuk WebSocket subscription E2E
    - Subscribe dengan JWT tenant A → assert hanya menerima event tenant A
    - Test heartbeat timeout dan close code 4401 untuk JWT invalid
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 13. Checkpoint - Pastikan tests pass
  - Pastikan seluruh test pass, tanyakan ke user jika ada pertanyaan.

- [ ] 14. Log Store (`packages/log-store`)
  - [ ] 14.1 Implementasikan ClickHouse adapter dengan append-only writes
    - Skema tabel `logs` partisi by date, primary key `(tenant_id, run_id, step_id, ts)`
    - Tidak ekspor operasi update/delete pada level entry
    - _Requirements: 4.4_
  - [ ] 14.2 Implementasikan query API dengan filter waktu + pagination
    - `query(runId, stepId?, fromTs?, toTs?, pagination)` mengembalikan entries dalam urutan `ts` monotonic per `(run_id, step_id)`; default page size 50, max 200
    - Tolak range > 30 hari
    - _Requirements: 3.6, 3.7_
  - [ ] 14.3 Implementasikan retention tier scheduler (hot/warm/cold)
    - Job harian: pindahkan entry usia 30–180 hari ke `warm`, > 180 hari ke `cold` (S3 Glacier interface)
    - _Requirements: 4.4_
  - [ ]* 14.4 Tulis unit tests untuk log query dan retention
    - Test ordering monotonic, range guard 30 hari, pagination boundary
    - _Requirements: 3.7, 4.4_

- [ ] 15. AI Gateway (`packages/ai-gateway`)
  - [ ] 15.1 Implementasikan LLM provider abstraction + feature flag
    - Interface `LLMClient.chat(systemPrompt, userPrompt, schema)` dengan implementasi OpenAI/Anthropic; feature flag `AI_ENABLED` di config
    - Bila flag false, route prefix `/ai/` mengembalikan 404 di API Gateway
    - _Requirements: 6.13_
  - [ ] 15.2 Implementasikan prompt builder dengan sanitization + PII redaction
    - Wrap user content dalam delimiter `<<<USER_REQUEST>>> ... <<<END_USER_REQUEST>>>`; strip control token
    - Redact email, nomor telepon, national ID sebelum mengirim ke LLM eksternal sesuai kebijakan tenant
    - Tolak gabungan prompt > 4,000 token dengan 413
    - _Requirements: 6.1, 6.9, 6.12_
  - [ ] 15.3 Implementasikan endpoint `POST /ai/generate-workflow` dengan re-prompt loop
    - Validasi role (Editor/Admin), kalau bukan return 403 sebelum hit LLM
    - Kirim ke LLM dengan timeout 30 detik (return 504 bila lewat)
    - Validasi output via `validateAndSortDAG`; bila gagal, satu kali re-prompt dengan error feedback; bila masih gagal, return 422 dengan list `{ step_id, issue }`
    - Tolak step `SCRIPT` yang dihasilkan LLM by default; tandai output sebagai DRAFT
    - DRAFT tidak dipersist sampai user klik Save (endpoint terpisah memakai `createWorkflow`)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.10, 6.11_
  - [ ] 15.4 Implementasikan token budget tracker di Redis
    - Counter per tenant per hari, limit 100,000 token, reset 00:00 UTC
    - Return 429 saat habis tanpa meneruskan ke LLM
    - _Requirements: 6.7, 6.8_
  - [ ]* 15.5 Tulis unit tests untuk AI guardrails
    - Test 403 untuk Viewer; 504 saat LLM timeout; 422 saat re-prompt tetap gagal; 413 untuk prompt > 4,000 token; 429 saat budget habis; 404 saat AI disabled; SCRIPT step LLM ditolak; DRAFT tidak dipersist
    - _Requirements: 6.1–6.13_

- [ ] 16. Infrastructure dan deployment
  - [ ] 16.1 Lengkapi `docker-compose.yml` dengan seluruh service + healthcheck
    - Service: `api`, `orchestrator`, `worker`, `scheduler`, `realtime`, `ai-gateway`, `postgres`, `redis`, `clickhouse`, `migrate`
    - Healthcheck per service, target `healthy` ≤ 120 detik pada baseline 4 vCPU/8 GB
    - _Requirements: 5.1_
  - [ ] 16.2 Implementasikan migration auto-run pada API startup
    - Jalankan migration sampai selesai sebelum API menerima request HTTP
    - Bila migration gagal: exit code non-zero, tidak menerima request, healthcheck tetap unhealthy
    - _Requirements: 5.2, 5.3_
  - [ ] 16.3 Implementasikan Prometheus metrics emission
    - Counter run per status, histogram latency per endpoint (p50/p95/p99), gauge WS event rate, gauge queue size, counter rate limit hit per tenant per 60s window
    - Endpoint `/metrics` di setiap service
    - _Requirements: 5.6_
  - [ ] 16.4 Lengkapi CI pipeline GitHub Actions
    - Jobs berurutan: `lint` → `typecheck` → `test:unit` → `test:property` (P1–P10, ≥ 100 iterasi/property) → `test:integration` → `build:image`
    - Coverage gate: line ≥ 85%, branch ≥ 75% pada `parser`, `orchestrator`, `auth`; total durasi PR ≤ 10 menit
    - Pipeline gagal pada step apapun → tidak push image, tidak deploy
    - _Requirements: 5.8, 5.9, 8.1, 8.2, 8.3, 8.6, 8.7_
  - [ ] 16.5 Tulis cloud deployment manifest (Terraform module sketch)
    - Mapping: ALB, ECS Fargate / GKE Autopilot, RDS PostgreSQL Multi-AZ, ElastiCache Redis, S3 + Glacier, Secrets Manager
    - _Requirements: 5.7_

- [ ] 17. Frontend dashboard MVP (`packages/web`, React + TypeScript)
  - [ ] 17.1 Implementasikan auth flow + JWT storage
    - Halaman login, simpan JWT di httpOnly cookie / secure storage, lampirkan ke setiap request + WS upgrade
    - _Requirements: 2.3_
  - [ ] 17.2 Implementasikan workflow editor dengan validasi parser inline
    - Form / JSON editor; panggil parser shared package untuk preview error sebelum submit
    - _Requirements: 1.1, 9.1_
  - [ ] 17.3 Implementasikan run detail view dengan WebSocket subscription
    - Subscribe `runId`, render timeline step real-time, handle reconnect + snapshot
    - _Requirements: 3.1, 3.5_
  - [ ] 17.4 Implementasikan log viewer dengan pagination
    - Konsumsi `getRunLogs`, filter by `step_id`, range waktu
    - _Requirements: 3.6, 3.7_

- [ ] 18. Wiring dan E2E
  - [ ] 18.1 Wire seluruh komponen di entry point API + orchestrator + worker
    - Setup graceful shutdown, propagasi `request_id`, dependency injection container, bootstrap order migrasi → API listen
    - _Requirements: 5.2, 5.4, 5.5_
  - [ ]* 18.2 Tulis E2E test workflow 3-step (HTTP → script → conditional)
    - Login tenant A, create workflow, trigger run, subscribe WebSocket, kumpulkan event, assert untuk setiap pasangan `(parent, child)` event `STEP_*` parent diterima sebelum child, assert `RUN_SUCCEEDED`, assert log entries dapat di-query, timeout test ≤ 60 detik
    - _Requirements: 8.4_

- [ ] 19. Final checkpoint - Pastikan seluruh test pass
  - Jalankan seluruh test (unit, property, integration, E2E) plus coverage gate; verifikasi pipeline CI hijau dan tanyakan ke user jika ada pertanyaan.

## Notes

- Tasks bertanda `*` adalah optional dan dapat di-skip untuk MVP yang lebih cepat; namun property test P1–P10 wajib dijalankan di CI sesuai requirement 8.3 sebelum release production.
- Setiap task mereferensikan acceptance criteria spesifik (mis. `Requirements: 2.1`) bukan hanya user story, untuk traceability granular.
- Property tests dipisah satu sub-task per property dan diletakkan dekat task implementasi yang relevan agar regresi tertangkap dini.
- Checkpoint task (5, 8, 13, 19) berfungsi sebagai gate untuk memastikan stabilitas sebelum melangkah ke fase berikutnya.
- Lint rule custom yang menolak query tanpa `tenant_id` (task 1.2) plus runtime guard pada repository base (task 2.4) adalah dua lapisan pertahanan untuk Property 1 (Tenant Isolation).
- Frontend dashboard (task 17) sengaja minimal MVP; ekspansi UX (visual DAG editor, dll.) di luar scope plan ini.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "4.1", "9.1", "9.2"] },
    { "id": 3, "tasks": ["2.3", "2.4", "3.2", "3.3", "3.4", "4.2", "9.3", "9.4", "9.5", "12.1", "14.1"] },
    { "id": 4, "tasks": ["2.5", "3.5", "3.6", "3.7", "6.1", "6.3", "9.6", "9.7", "12.2", "12.3", "14.2", "14.3", "15.1", "17.1"] },
    { "id": 5, "tasks": ["6.2", "6.4", "6.5", "6.6", "6.8", "7.1", "10.1", "12.4", "14.4", "15.2"] },
    { "id": 6, "tasks": ["6.7", "6.9", "6.10", "7.2", "7.3", "7.4", "7.5", "10.2", "10.4", "10.5", "10.6", "11.1", "12.5", "15.3", "15.4", "16.2"] },
    { "id": 7, "tasks": ["7.6", "7.7", "10.3", "10.7", "12.6", "15.5", "17.2", "17.3", "17.4"] },
    { "id": 8, "tasks": ["10.8", "11.2", "12.7"] },
    { "id": 9, "tasks": ["11.3", "16.1"] },
    { "id": 10, "tasks": ["16.3", "16.4", "16.5", "18.1"] },
    { "id": 11, "tasks": ["18.2"] }
  ]
}
```
