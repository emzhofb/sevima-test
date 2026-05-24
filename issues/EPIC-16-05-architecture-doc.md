# [Epic-16] Architecture and trade-offs documentation

**Labels**: `epic-16`, `area-docs`
**Estimate**: 2 jam
**Depends on**: None

## Context

Required by original spec: arsitektur overview + trade-offs.

## Acceptance Criteria

- [ ] `docs/ARCHITECTURE.md` dengan diagram (mermaid OK)
- [ ] `docs/TRADEOFFS.md` mendaftarkan keputusan + alasan
- [ ] Bagian "What I would improve with more time"

## Implementation Hints

Untuk fresh grad: copy bagian dari design.md yang relevan, simplify, tambah konteks "kenapa kita pilih ini".

`docs/ARCHITECTURE.md` outline:

```markdown
# Architecture Overview

FlowForge dibagi menjadi tiga plane:

## Control Plane
- API (Fastify + REST)
- Auth (JWT, Argon2id)
- Scheduler (cron evaluator)

## Data Plane
- Orchestrator (DAG state machine)
- Worker (step executor)
- Redis Streams (broker)

## Observability Plane
- Realtime hub (WebSocket)
- PostgreSQL `logs` table

## Diagram

\`\`\`mermaid
graph TB
  Client --> API
  API --> Postgres[(PostgreSQL)]
  API --> Redis[(Redis)]
  Redis --> Orchestrator
  Orchestrator --> Worker
  Worker --> Postgres
  Worker --> Realtime
  Realtime --> Client
\`\`\`

## Request flow
1. Client → POST /workflows/:id/runs
2. API insert run row + enqueue
3. Orchestrator dequeue + load definition
4. Orchestrator enqueue ready steps
5. Worker dequeue → execute → publish event
6. Orchestrator handle event → enqueue next
```

`docs/TRADEOFFS.md`:

```markdown
# Trade-offs Made

## 1. Single-replica orchestrator (vs multi-replica)
Original spec menyebutkan partitioning by run_id. Untuk MVP, kita pakai single replica untuk menghindari kompleksitas distributed locking. Trade-off: kalau orchestrator crash, run yang sedang RUNNING bisa stuck sampai restart. Acceptable untuk MVP karena heartbeat scanner bisa recover.

## 2. PostgreSQL logs table (vs ClickHouse)
ClickHouse lebih efisien untuk volume tinggi tapi nambah operational complexity. PostgreSQL partitioned table cukup sampai ~10M log entries. Migrate ke ClickHouse kalau scaling jadi masalah.

## 3. child_process script sandbox (vs Docker/Firecracker)
Implementasi sandbox saat ini TIDAK isolated network/filesystem. Diakui sebagai security limitation untuk MVP. Production deploy WAJIB ganti ke Docker per-step atau Firecracker MicroVM.

## 4. Static rate limit per route (vs adaptive)
Default 600 req/60s sama untuk semua tenant. Kalau ada tenant noisy, perlu config override per tenant.

## 5. JSON for log fields (vs structured columns)
Pakai jsonb untuk fleksibilitas. Trade-off: query atas field tertentu butuh GIN index ekstra.

# What I'd Improve with More Time

- [ ] Multi-replica orchestrator dengan run_id partitioning
- [ ] Docker-based sandbox untuk SCRIPT step
- [ ] ClickHouse atau Loki untuk log store
- [ ] Property-based testing dengan fast-check
- [ ] OpenTelemetry traces (saat ini cuma metrics)
- [ ] GraphQL endpoint
- [ ] Visual workflow editor di UI (saat ini cuma JSON textarea)
- [ ] Webhook secret di-encrypt at rest, bukan plaintext
- [ ] RS256 JWT (saat ini HS256)
- [ ] Multi-region support
```

## Files Involved

- `docs/ARCHITECTURE.md`
- `docs/TRADEOFFS.md`

## How to Verify

Dibaca, mermaid diagram render di GitHub.
