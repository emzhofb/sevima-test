# Requirements Document

## Introduction

FlowForge adalah platform self-hosted multi-tenant untuk mendefinisikan, mengeksekusi, memantau, dan berkolaborasi pada automated workflows secara real-time. Sistem menggabungkan eksekusi berbasis DAG (mirip GitHub Actions) dengan paradigma trigger fleksibel (mirip Zapier), dan dibagi menjadi tiga bidang tanggung jawab utama: Control Plane (API, auth, scheduler), Data Plane (orchestrator, worker pool, broker), dan Observability Plane (WebSocket hub, log store).

Dokumen ini mendefinisikan requirements yang diturunkan dari design document yang sudah disetujui. Requirements ditulis dalam pola EARS (Easy Approach to Requirements Syntax) dan menjadi sumber untuk Correctness Properties yang sudah ada di design.

Cakupan requirements meliputi:
1. Workflow Definition & DAG Execution Engine
2. Multi-Tenant API Layer (auth, RBAC, scheduler, webhook, rate limit, versioning)
3. Real-Time Monitoring & Observability (WebSocket/SSE, run history, log query)
4. Data Layer & Persistence
5. Infrastructure & Deployment
6. AI-Powered Natural Language Workflow Builder
7. Security & Sandboxing
8. Code Quality & Engineering Practices
9. Workflow Definition Parser Round-Trip

## Glossary

- **FlowForge**: Sistem keseluruhan yang mencakup semua sub-system di bawah ini.
- **DAG_Parser**: Komponen yang memparse, memvalidasi, dan men-topologically-sort definisi workflow.
- **Orchestrator**: State machine eksekusi yang melacak dan memajukan state setiap run.
- **Worker**: Proses yang mengeksekusi step individual dengan retry dan timeout per-step.
- **Scheduler**: Komponen yang mengevaluasi cron expression dan men-trigger run terjadwal.
- **API_Gateway**: HTTP layer yang melakukan auth, RBAC, rate limit, dan validasi input.
- **Auth_Middleware**: Komponen yang memverifikasi JWT dan mem-bind `tenant_id`, `user_id`, `role` ke request context.
- **Realtime_Hub**: WebSocket / SSE pub-sub hub yang mendistribusikan event eksekusi ke client.
- **Log_Store**: Penyimpanan append-only untuk log eksekusi volume tinggi (ClickHouse / S3).
- **AI_Gateway**: Komponen yang men-translate deskripsi natural language menjadi `WorkflowDefinition` melalui LLM.
- **Tenant**: Organisasi terisolasi; setiap row di tabel domain tagged dengan `tenant_id`.
- **Workflow**: Definisi DAG yang dimiliki oleh sebuah tenant, terdiri dari satu atau lebih `WorkflowVersion`.
- **WorkflowVersion**: Snapshot immutable dari `WorkflowDefinition` pada `version` tertentu.
- **Run**: Satu eksekusi dari sebuah `WorkflowVersion`, memiliki status `PENDING | RUNNING | SUCCEEDED | FAILED | CANCELLED | TIMED_OUT`.
- **StepRun**: Eksekusi satu step dalam sebuah run, memiliki status `PENDING | READY | RUNNING | SUCCEEDED | FAILED | SKIPPED`.
- **RetryPolicy**: Konfigurasi `max_attempts`, `backoff_base_ms`, `backoff_max_ms`, `jitter` per step.
- **EARS**: Easy Approach to Requirements Syntax (pola WHEN/IF/WHILE/WHERE/THE/SHALL).
- **RBAC_Role**: Salah satu dari `ADMIN`, `EDITOR`, `VIEWER`.
- **Tenant_Scoped_Query**: Query yang menyertakan predikat `tenant_id = $current_tenant`.

## Requirements

### Requirement 1: Workflow Definition & DAG Execution Engine

**User Story:** Sebagai workflow author, saya ingin mendefinisikan workflow sebagai DAG dan menjalankannya secara handal dengan retry dan resume otomatis, sehingga saya dapat membangun automation yang tahan terhadap kegagalan transient tanpa kehilangan progress.

#### Acceptance Criteria

1. WHEN sebuah `WorkflowDefinition` dikirim untuk dipersist, THE DAG_Parser SHALL menolak definisi yang mengandung cycle, dangling dependency, atau duplicate step id, dan hanya menerima definisi yang lulus `validateAndSortDAG` dengan `ok = true`, dengan respon error berupa daftar issue terstruktur yang mencantumkan `step_id` (atau `null` jika error pada level DAG keseluruhan) dan kategori issue (`cycle | dangling_dependency | duplicate_id`).
2. WHEN sebuah `Run` sedang aktif, THE Orchestrator SHALL hanya men-dispatch step yang seluruh `depends_on`-nya berstatus `SUCCEEDED` atau `SKIPPED`, dan SHALL mengikuti FSM run `PENDING → RUNNING → {SUCCEEDED | FAILED | CANCELLED | TIMED_OUT}` di mana setiap transisi keluar dari status terminal SHALL ditolak.
3. WHEN sebuah step gagal dan `attempt < retry.max_attempts`, THE Worker SHALL menjadwalkan ulang step dengan delay `computeBackoff(attempt, policy)` di mana `0 <= delay <= policy.backoff_max_ms`, dan THE Worker SHALL TIDAK menjalankan step melebihi `retry.max_attempts` attempt total.
4. THE DAG_Parser SHALL menerima step bertipe `HTTP`, `SCRIPT`, `DELAY`, dan `CONDITIONAL` sesuai schema `StepSpec` di design, dan SHALL menolak step bertipe lain dengan error terstruktur yang mencantumkan `step_id` dan kategori issue `unknown_step_type`.
5. WHEN `now() - run.started_at > workflow.timeout_sec`, THE Orchestrator SHALL menandai run sebagai `TIMED_OUT` dalam waktu ≤ 5 detik sejak kondisi terpenuhi, mengirim sinyal cancel ke setiap worker yang masih menjalankan step run tersebut, dan memancarkan event `RUN_TIMED_OUT` tepat satu kali per run.
6. WHEN sebuah step gagal setelah retry habis dan `continue_on_failure = true`, THE Orchestrator SHALL menandai step tersebut `FAILED` namun tetap melanjutkan run dengan mengevaluasi ready set berikutnya.
7. IF sebuah step gagal setelah retry habis dan `continue_on_failure = false`, THEN THE Orchestrator SHALL menandai run sebagai `FAILED`, menghentikan dispatch step baru, dan memancarkan event `RUN_FAILED` tepat satu kali per run.
8. IF sebuah `Run` di-cancel oleh user, THEN THE Orchestrator SHALL menghentikan dispatch step baru dan menandai run sebagai `CANCELLED` dalam waktu ≤ 5 detik setelah cancel diterima, dan memancarkan event `RUN_CANCELLED` tepat satu kali per run.
9. THE DAG_Parser SHALL menolak `WorkflowDefinition` di mana `RetryPolicy.max_attempts < 1` atau `> 10`, atau `timeout_sec <= 0` atau `> 86400`, dengan respon error terstruktur yang mencantumkan field yang melanggar dan rentang yang valid.
10. WHEN handler event step menerima dua event dengan `event_id` yang sama, THE Orchestrator SHALL memproses event kedua tanpa menghasilkan side-effect tambahan (tidak ada update DB tambahan, tidak ada enqueue ulang, tidak ada emit WebSocket ulang), sehingga state akhir setelah pemrosesan kedua identik dengan state setelah pemrosesan pertama.
11. WHEN Orchestrator restart atau Worker tidak merespons dalam window heartbeat timeout yang dikonfigurasi, THE Orchestrator SHALL mengembalikan step run yang berstatus `RUNNING` dan tidak memiliki heartbeat aktif ke status `READY` untuk attempt berikutnya, dengan mempertahankan seluruh state yang sudah persist (`SUCCEEDED` dan `SKIPPED` step tidak dijalankan ulang).

### Requirement 2: Multi-Tenant API Layer

**User Story:** Sebagai operator multi-tenant SaaS, saya ingin setiap tenant terisolasi secara ketat, schedule berjalan tepat sekali per window, dan request dari satu tenant tidak mempengaruhi tenant lain, sehingga saya dapat melayani banyak organisasi dari satu deployment dengan aman.

#### Acceptance Criteria

1. THE API_Gateway SHALL menjamin bahwa setiap response yang dikembalikan ke request `r` hanya berisi row dengan `tenant_id = jwt.tenant_id` dari `r`, untuk semua endpoint termasuk list, getById, run query, log query, dan WebSocket event.
2. WHILE multiple replica `Scheduler` aktif, THE Scheduler SHALL menjamin bahwa untuk setiap `Schedule` `s` dan setiap window cron `w`, jumlah `Run` dengan `trigger_type = SCHEDULED` yang dipicu oleh `s` dan `started_at ∈ w` adalah at most 1, menggunakan `SELECT ... FOR UPDATE SKIP LOCKED` pada tabel `schedules`.
3. WHEN sebuah HTTP request diterima dengan header `Authorization: Bearer <token>`, THE Auth_Middleware SHALL memverifikasi tanda tangan JWT (RS256), memvalidasi `exp` dan `iat`, dan mem-bind `tenant_id`, `user_id`, `role` ke request context; IF token tidak ada, malformed, kadaluarsa, atau signature tidak valid, THEN THE Auth_Middleware SHALL mengembalikan HTTP 401.
4. WHERE sebuah route memerlukan `RBAC_Role` minimum `R`, IF `request.user.role` tidak memenuhi hierarchy `ADMIN > EDITOR > VIEWER`, THEN THE API_Gateway SHALL mengembalikan HTTP 403 sebelum handler domain dipanggil.
5. WHEN sebuah tenant melebihi kuota request 600 request per 60 detik per route (kuota ini SHALL configurable per tenant), THE API_Gateway SHALL mengembalikan HTTP 429 dengan header `Retry-After` bernilai antara 1 dan 60 detik, menggunakan token bucket di Redis dengan key `rl:<tenant_id>:<route>`.
6. WHEN sebuah webhook payload diterima pada `POST /webhooks/<tenant_slug>/<workflow_id>`, THE API_Gateway SHALL memverifikasi signature HMAC-SHA256 atas body + timestamp menggunakan secret unik per tenant, dan menolak request dengan timestamp lebih dari 5 menit dari waktu server saat ini; IF signature invalid atau timestamp di luar window, THEN THE API_Gateway SHALL mengembalikan HTTP 401 dengan body generik yang tidak dapat dibedakan antara kegagalan signature dan kegagalan timestamp.
7. THE API_Gateway SHALL menyediakan endpoint CRUD untuk `Workflow` (`createWorkflow`, `getWorkflow`, `listWorkflows`, `updateWorkflow`, `rollbackWorkflow`, `deleteWorkflow`) sesuai interface `WorkflowAPI` di design, dengan pagination (`page >= 1` default 1, `pageSize` antara 1 dan 100 default 20) dan filtering minimal: pencarian substring pada `name`, filter `status`, dan filter rentang `created_at` pada list endpoint.
8. WHEN `rollbackWorkflow(ctx, workflowId, targetVersion)` dipanggil oleh user dengan role `ADMIN`, THE API_Gateway SHALL menciptakan `WorkflowVersion` baru dengan `definition` dari `targetVersion` dan memajukan `current_version` ke versi baru, tanpa menghapus atau memodifikasi versi lama; run yang sedang berjalan SHALL melanjutkan eksekusi pada versi yang ter-bound saat trigger, sementara setiap `triggerRun` selanjutnya SHALL menggunakan `current_version` baru.
9. WHEN `triggerRun(ctx, workflowId, input)` dipanggil oleh user dengan role `ADMIN` atau `EDITOR` dan `input` lulus validasi schema input workflow, THE API_Gateway SHALL menciptakan `Run` baru dengan `status = PENDING`, `tenant_id = ctx.tenant_id`, mengantrikan run ke broker, dan mengembalikan HTTP 202 dengan `run_id` dalam waktu p99 < 200 ms pada beban ≤ 100 concurrent request per replica.
10. IF `input` pada `triggerRun` gagal validasi schema input workflow, THEN THE API_Gateway SHALL mengembalikan HTTP 400 dengan respon error terstruktur yang mencantumkan field yang melanggar dan kategori issue, tanpa menciptakan `Run` baru.
11. WHEN `updateWorkflow(ctx, workflowId, definition)` dipanggil oleh user dengan role `ADMIN` atau `EDITOR`, THE API_Gateway SHALL menciptakan `WorkflowVersion` baru dengan `version = current_version + 1`, dan SHALL TIDAK memodifikasi field manapun pada `WorkflowVersion` yang sudah ada.
12. THE Auth_Middleware SHALL menyimpan password user dengan algoritma Argon2id parameter `memory >= 64MB` dan `iterations >= 3`, dan SHALL TIDAK menyimpan plaintext password.

### Requirement 3: Real-Time Monitoring & Observability

**User Story:** Sebagai operator workflow, saya ingin melihat status eksekusi run dan step secara real-time tanpa polling, sehingga saya dapat mendeteksi kegagalan dengan cepat dan memberikan feedback yang responsif kepada user.

#### Acceptance Criteria

1. WHEN sebuah event eksekusi (`RUN_QUEUED`, `RUN_STARTED`, `STEP_STARTED`, `STEP_SUCCEEDED`, `STEP_FAILED`, `RUN_SUCCEEDED`, `RUN_FAILED`, `RUN_TIMED_OUT`, `RUN_CANCELLED`) di-emit oleh Orchestrator atau Worker, THE Realtime_Hub SHALL mendistribusikan event hanya ke koneksi `c` yang memenuhi `event.tenant_id = c.tenant_id` DAN user pada `c` memiliki RBAC minimal `VIEWER` pada `event.run_id`, dengan end-to-end latency dari emit hingga delivery ke client P95 ≤ 2 detik dan P99 ≤ 5 detik diukur pada koneksi sehat.
2. WHEN sebuah client melakukan WebSocket upgrade dengan JWT, THE Realtime_Hub SHALL memverifikasi JWT melalui Auth_Middleware sebelum subscription manapun diterima.
3. IF JWT yang dikirim pada WebSocket upgrade invalid, expired, atau gagal verifikasi oleh Auth_Middleware, THEN THE Realtime_Hub SHALL menutup koneksi dengan close code 4401 sebelum subscription manapun diterima.
4. WHILE sebuah koneksi WebSocket aktif, THE Realtime_Hub SHALL mengirim ping heartbeat setiap 30 detik dan menutup koneksi yang tidak mengirim pong response dalam window 60 detik sejak ping terakhir.
5. IF buffer pengiriman per-koneksi mencapai 1000 entries karena client lambat, THEN THE Realtime_Hub SHALL menerapkan backpressure dengan men-drop event lama dan mengirim "snapshot" state run terkini saat bandwidth tersedia, alih-alih meng-block emit pada Orchestrator, dengan menjamin operasi emit pada Orchestrator non-blocking dan menyelesaikan dalam ≤ 50 ms per event.
6. THE API_Gateway SHALL menyediakan endpoint `getRun`, `listRuns`, dan `getRunLogs` yang mengembalikan run history dan log dengan filter wajib `tenant_id`, pagination (default page size 50, maksimum 200 entries per request), dan optional `step_id` filter, dengan response time P95 ≤ 1 detik.
7. WHEN `getRunLogs` dipanggil dengan parameter range waktu, THE Log_Store SHALL mengembalikan entries dalam urutan `ts` monotonic per `(run_id, step_id)` dan menolak request dengan range waktu melebihi 30 hari dengan error indikasi range melebihi batas.

### Requirement 4: Data Layer & Persistence

**User Story:** Sebagai engineer yang memelihara FlowForge, saya ingin source of truth yang transactional, query yang efisien per tenant, dan log volume tinggi yang murah, sehingga sistem dapat tumbuh dari ratusan ke jutaan run tanpa redesign storage.

#### Acceptance Criteria

1. THE FlowForge SHALL mempersist `Tenant`, `User`, `Workflow`, `WorkflowVersion`, `Run`, `StepRun`, dan `Schedule` di PostgreSQL sesuai schema ER di design, di mana semua tabel domain memiliki kolom `tenant_id` non-nullable, dan SHALL menjamin bahwa operasi `createWorkflow` yang menciptakan baris pada `workflows` dan `workflow_versions` dijalankan dalam satu transaksi atomic (commit bersama atau rollback bersama).
2. THE FlowForge SHALL membuat critical index berikut: `idx_runs_tenant_started (tenant_id, started_at DESC)`, `idx_step_runs_run (run_id, step_id)`, `idx_schedules_due (next_run_at) WHERE enabled = true`, `idx_workflow_versions_wf (workflow_id, version DESC)`, dan `idx_workflows_tenant_updated (tenant_id, updated_at DESC)`.
3. WHEN `listRuns` di-query untuk dashboard dengan `pageSize <= 200` dan rentang `started_at <= 30 hari`, THE PostgreSQL SHALL menggunakan `idx_runs_tenant_started` sehingga rencana eksekusi adalah index scan backward dengan limit, dan p99 latency tetap < 50 ms pada dataset 1 juta runs.
4. THE Log_Store SHALL mendukung append-only writes per `(tenant_id, run_id, step_id, ts)` tanpa update atau delete pada level entry, DAN SHALL menerapkan tier retensi: `hot` untuk entry usia 0–30 hari, `warm` untuk 30–180 hari, dan `cold` (mis. S3 Glacier) untuk entry lebih dari 180 hari.
5. IF predikat `tenant_id` tidak hadir pada query terhadap tabel tenant-scoped, THEN THE FlowForge SHALL menolak eksekusi query dengan melempar exception ke caller dan mencatat violation ke audit log, melalui repository layer enforcement atau static lint pada CI.
6. THE Tenant.slug SHALL mematuhi pola regex `^[a-z0-9][a-z0-9-]{1,62}$` dan SHALL unique secara global, DAN THE User.email SHALL unique per `(tenant_id, email)`.

### Requirement 5: Infrastructure & Deployment

**User Story:** Sebagai operator yang mendeploy FlowForge, saya ingin sistem dapat dijalankan secara lokal dengan satu perintah dan dideploy ke cloud dengan komponen managed, sehingga onboarding cepat dan operasi production reliable.

#### Acceptance Criteria

1. THE FlowForge SHALL menyediakan `docker-compose.yml` yang mem-boot seluruh stack (API, Orchestrator, Worker, Scheduler, PostgreSQL, Redis, Log_Store, Realtime_Hub) dengan satu perintah `docker-compose up`, di mana setiap service mencapai health check `healthy` dalam ≤ 120 detik pada baseline hardware 4 vCPU dan 8 GB RAM.
2. WHEN API container memulai start sequence, THE FlowForge SHALL menjalankan migration script database hingga selesai sebelum API menerima request HTTP pertama.
3. IF migration script gagal pada saat startup, THEN THE FlowForge SHALL menghentikan API process dengan exit code non-zero, tidak menerima request HTTP, dan tidak melaporkan health check `healthy`.
4. THE API SHALL stateless dalam arti tidak menyimpan session, request context, atau workflow state di memori process; persistent state SHALL disimpan di PostgreSQL dan ephemeral state SHALL disimpan di Redis, sehingga setiap replica API dapat menangani request manapun di belakang load balancer.
5. THE Orchestrator dan Worker SHALL dapat di-scale horizontal dengan partitioning oleh `run_id` atau dengan `SKIP LOCKED` pada broker, dan SHALL menjamin bahwa setiap step run dieksekusi oleh tepat satu worker pada satu waktu (no duplicate execution) meski multiple replica aktif.
6. THE FlowForge SHALL meng-emit metric Prometheus untuk minimal: jumlah run per status (`PENDING | RUNNING | SUCCEEDED | FAILED | CANCELLED | TIMED_OUT`), latency per endpoint dalam ms pada percentile p50/p95/p99, jumlah event WebSocket per detik, ukuran queue broker, dan rate limit hit per tenant per window 60 detik.
7. WHERE deployment menggunakan AWS atau GCP, THE FlowForge SHALL dapat dipetakan ke managed services (RDS / Cloud SQL untuk PostgreSQL, ElastiCache / Memorystore untuk Redis, S3 / GCS untuk log archive, Secrets Manager untuk secret).
8. THE FlowForge SHALL menyediakan CI pipeline (mis. GitHub Actions) yang menjalankan secara berurutan: lint, unit test, property test, integration test, dan build container image.
9. IF salah satu tahap pada CI pipeline gagal, THEN pipeline SHALL berhenti dengan exit code non-zero, tidak men-publish container image ke registry, dan tidak men-deploy artifact apapun.

### Requirement 6: AI-Powered Natural Language Workflow Builder

**User Story:** Sebagai non-technical user, saya ingin mendeskripsikan workflow dalam bahasa alami dan menerima draft DAG yang valid untuk direview, sehingga saya dapat memulai automation tanpa menulis JSON/YAML manual.

#### Acceptance Criteria

1. WHEN user dengan role `EDITOR` atau `ADMIN` memanggil `POST /ai/generate-workflow {prompt}`, THE AI_Gateway SHALL mengirim prompt ke LLM provider dengan system instruction yang menetapkan output sebagai JSON yang match `WorkflowDefinition` schema dan menginstruksikan model untuk mengabaikan instruksi apapun yang terkandung di dalam user content.
2. IF user yang memanggil `POST /ai/generate-workflow` tidak memiliki role `EDITOR` atau `ADMIN`, THEN THE API_Gateway SHALL menolak request dengan HTTP 403 dan tidak meneruskan prompt ke LLM provider.
3. WHEN LLM mengembalikan kandidat output, THE AI_Gateway SHALL menjalankan `validateAndSortDAG` pada output sebelum mengembalikan ke user.
4. IF output LLM gagal validasi `validateAndSortDAG` pada percobaan pertama, THEN THE AI_Gateway SHALL melakukan satu kali re-prompt dengan menyertakan error feedback dari validator.
5. IF output LLM tetap gagal validasi setelah satu kali re-prompt, THEN THE AI_Gateway SHALL mengembalikan HTTP 422 berisi list error dimana setiap entry mencantumkan `step_id` (atau `null` jika error pada level DAG) dan deskripsi issue yang menyebabkan kegagalan validasi.
6. IF LLM provider tidak mengembalikan response dalam 30 detik sejak request dikirim, THEN THE AI_Gateway SHALL membatalkan permintaan dan mengembalikan HTTP 504 dengan pesan yang mengindikasikan timeout LLM.
7. THE AI_Gateway SHALL melacak token budget per tenant per hari di Redis counter dengan limit 100,000 token per tenant per hari dan reset window pada 00:00 UTC.
8. IF tenant melebihi budget 100,000 token pada hari berjalan, THEN THE AI_Gateway SHALL mengembalikan HTTP 429 dengan pesan budget exceeded dan tidak meneruskan request ke LLM provider.
9. IF gabungan system prompt dan user prompt melebihi 4,000 token, THEN THE AI_Gateway SHALL mengembalikan HTTP 413 dengan saran untuk mempersempit prompt dan tidak meneruskan request ke LLM provider.
10. THE AI_Gateway SHALL menolak by default step bertipe `SCRIPT` yang dihasilkan LLM dan menandai output yang dikembalikan ke user sebagai DRAFT.
11. IF user belum melakukan aksi "Save" eksplisit pada DRAFT yang dihasilkan, THEN THE AI_Gateway SHALL tidak mem-persist DRAFT tersebut sebagai `WorkflowVersion` di storage `workflow_versions`.
12. THE AI_Gateway SHALL melakukan PII redaction pada prompt sebelum dikirim ke LLM eksternal sesuai kebijakan tenant, mencakup minimal kategori email address, nomor telepon, dan national ID.
13. WHERE feature AI di-disable melalui konfigurasi deployment, THE API_Gateway SHALL mengembalikan HTTP 404 pada seluruh endpoint dengan path prefix `/ai/`.

### Requirement 7: Security & Sandboxing

**User Story:** Sebagai security engineer, saya ingin user-defined script dijalankan dengan sandbox ketat dan secret tidak pernah ter-leak, sehingga FlowForge aman digunakan untuk workflow yang menyentuh sistem internal sensitif.

#### Acceptance Criteria

1. WHEN sebuah step bertipe `SCRIPT` dieksekusi, THE Worker SHALL menjalankannya di container atau Firecracker MicroVM dengan CPU `<= 1` core, memory `<= 256 MB`, network egress allow-list, filesystem read-only kecuali `/tmp` dengan ukuran maksimal 100 MB, dan timeout per-step default 300 detik (rentang konfigurasi 1 sampai 3600 detik).
2. THE Worker SHALL meng-inject secret ke step hanya melalui environment variable yang scope-nya step tersebut, dengan secret di-resolve dari Secrets Manager via reference (mis. `{{secrets.api_key}}`); THE Worker SHALL TIDAK meng-expose secret ke step lain dalam run yang sama.
3. IF resolusi secret reference gagal karena secret tidak ditemukan atau akses ditolak, THEN THE Worker SHALL menggagalkan step dengan status `FAILED`, mencatat error indicating secret resolution failure tanpa menyertakan nilai atau path referensi secret, dan TIDAK mengeksekusi script.
4. IF step melebihi batas CPU 1 core, memory 256 MB, timeout yang dikonfigurasi, mencoba akses network di luar egress allow-list, atau mencoba menulis ke filesystem di luar `/tmp`, THEN THE Worker SHALL menghentikan eksekusi step dalam waktu `<= 5` detik, menandai step `FAILED` dengan error indicating resource atau policy violation, dan merilis seluruh resource sandbox.
5. THE FlowForge SHALL menerapkan redaction layer pada log writer sehingga secret yang tertangkap di output script atau response HTTP ditampilkan sebagai `***REDACTED***` di Log_Store, bahkan pada level DEBUG.
6. THE FlowForge SHALL mencatat audit log untuk setiap mutasi (workflow create/update/rollback, run trigger, role change, secret access) berisi `tenant_id`, `user_id`, `action`, `resource_id`, `timestamp`, `request_id`, dan SHALL menyimpan audit log secara immutable (append-only, tidak dapat di-update atau di-delete melalui antarmuka aplikasi) dengan retensi minimal 365 hari.
7. THE API_Gateway SHALL menerima koneksi hanya melalui TLS 1.3 di edge dan SHALL menolak handshake untuk koneksi tanpa TLS atau dengan TLS versi di bawah 1.3.
8. THE FlowForge SHALL membatasi ukuran payload request maksimal 1 MB dan SHALL menggunakan parameterized query untuk semua akses database.
9. IF payload request melebihi 1 MB, THEN THE API_Gateway SHALL menolak request dengan HTTP 413 sebelum diteruskan ke service backend.

### Requirement 8: Code Quality & Engineering Practices

**User Story:** Sebagai pengembang yang berkontribusi pada FlowForge, saya ingin codebase yang well-tested dan property-tested, sehingga refactor besar dapat dilakukan dengan percaya diri dan regresi terdeteksi otomatis.

#### Acceptance Criteria

1. THE FlowForge SHALL memiliki line coverage `>= 85%` dan branch coverage `>= 75%` pada paket `parser`, `orchestrator`, dan `auth`, diukur oleh test runner pada CI dengan total durasi build pada PR `<= 10` menit.
2. IF line coverage atau branch coverage pada paket `parser`, `orchestrator`, atau `auth` turun di bawah threshold yang ditetapkan, THEN CI SHALL gagal dengan exit code non-zero dan PR SHALL TIDAK dapat di-merge.
3. THE FlowForge SHALL memiliki property-based test untuk Correctness Properties P1–P10 di design (Tenant Isolation, DAG Validity, Topological Execution, Retry Bounded, Run Status Monotonicity, Backoff Bounded, At-Most-Once Schedule Trigger, WebSocket Authorization, Idempotensi, Versioning Immutability) dengan minimal 100 iterasi per property, dijalankan pada setiap PR di CI; IF property test gagal, THEN PR SHALL TIDAK dapat di-merge.
4. THE FlowForge SHALL memiliki minimal satu integration test end-to-end yang mengeksekusi workflow 3-step (HTTP → script → conditional), subscribe WebSocket, dan PASS jika untuk setiap pasangan step `(parent, child)` di DAG, event `STEP_*` parent diterima sebelum event `STEP_*` child, dengan timeout test `<= 60` detik.
5. WHEN sebuah bug diperbaiki, THE pull request SHALL menyertakan regression test yang dijalankan oleh CI, gagal pada commit sebelum fix, dan lulus pada commit setelah fix; IF regression test tidak hadir pada PR yang menyertakan fix, THEN PR SHALL TIDAK dapat di-merge.
6. THE codebase SHALL menggunakan static linter (ESLint / Ruff / yang sesuai bahasa) dan formatter, dijalankan di CI pada setiap PR.
7. IF lint atau format check gagal di CI, THEN CI SHALL gagal dengan exit code non-zero dan PR SHALL TIDAK dapat di-merge dengan pesan yang mengindikasikan rule yang dilanggar.

### Requirement 9: Workflow Definition Parser Round-Trip

**User Story:** Sebagai engineer yang memelihara `DAG_Parser`, saya ingin definisi workflow dapat dipelihara melalui round-trip JSON/YAML serialize ↔ parse tanpa kehilangan informasi, sehingga storage di database dan rendering di UI selalu konsisten.

#### Acceptance Criteria

1. WHEN sebuah `WorkflowDefinition` valid `d` diserialize ke JSON atau YAML dengan `serialize(d, format)` lalu di-parse ulang dengan `parse(serialize(d, format))`, THE DAG_Parser SHALL menghasilkan `WorkflowDefinition` `d'` yang ekivalen dengan `d`, di mana ekivalensi didefinisikan sebagai: kesetaraan field-by-field pada seluruh field schema `WorkflowDefinition`, preservasi urutan elemen pada list (`steps`, `depends_on`), dan tidak ada field tambahan atau hilang antara `d` dan `d'`.
2. THE DAG_Parser SHALL menyediakan pretty-printer yang memformat `WorkflowDefinition` ke JSON canonical (sorted keys secara lexicographic, indentasi 2 spasi, encoding UTF-8, line ending LF), di mana `prettyPrint(parse(prettyPrint(parse(input))))` menghasilkan output identik byte-by-byte dengan `prettyPrint(parse(input))` (idempotensi pretty print pada level byte).
3. IF input yang di-parse bukan JSON/YAML valid atau tidak match schema `WorkflowDefinition`, THEN THE DAG_Parser SHALL mengembalikan error terstruktur `{ error: "validation_failed", details: [{ step_id, issue }] }` di mana `step_id` adalah string `id` dari step yang melanggar atau `null` jika error pada level DAG keseluruhan, dan `issue` adalah salah satu kategori taxonomy: `cycle | dangling_dependency | duplicate_id | unknown_field | type_mismatch | missing_required | out_of_range`, tanpa create / modify / delete row apapun di storage; THE DAG_Parser SHALL menyelesaikan parse dalam waktu `<= 2` detik untuk input dengan ukuran `<= 5 MB`.
4. IF input yang di-parse melebihi 5 MB atau berisi lebih dari 1000 step, THEN THE DAG_Parser SHALL menolak input dengan error terstruktur `{ error: "input_too_large", details: [{ field, limit, actual }] }` sebelum melakukan parsing penuh, tanpa create / modify / delete row apapun di storage.
