# FlowForge

Multi-tenant workflow orchestration engine. Self-hosted blend of Zapier + GitHub Actions.

## Stack
- **Backend**: TypeScript, Node.js 20, Fastify
- **Frontend**: React, Vite
- **DB**: PostgreSQL 15 (jsonb + partitioned logs)
- **Cache/Broker**: Redis 7 (Streams)
- **Auth**: JWT (HS256) + Argon2id

## Quick Start

```bash
# 1. Clone
git clone <repo>
cd flowforge

# 2. Bootstrap
cp backend/.env.example backend/.env
docker compose up --build -d

# 3. Wait for migrations (~30s)
docker compose logs -f migrate

# 4. Seed dev data
pnpm seed
# Output: tenant=acme, email=admin@acme.com, password=password123

# 5. Login
open http://localhost:5173
```

## Folder Structure

```
packages/
  api/          REST API (Fastify)
  orchestrator/ DAG state machine
  worker/       Step executor
  scheduler/    Cron evaluator
  realtime/     WebSocket hub
  parser/       DAG validation + serializer
  auth/         JWT + RBAC + rate limit
  shared/       DB, broker, types
  web/          React dashboard (frontend/ folder)
docs/           Architecture, trade-offs, security notes
migrations/     SQL migrations
```

## Development

```bash
pnpm install
docker compose up -d postgres redis
pnpm migrate:up
pnpm seed
pnpm dev:all   # all services with hot reload
```

## Testing

```bash
pnpm test              # all unit + integration tests
pnpm test:coverage     # with coverage report
pnpm -F @flowforge/parser test  # one package
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Trade-offs](docs/TRADEOFFS.md)
- [REVIEW.md exercise](REVIEW.md)

## Known Limitations (MVP)

- Single-replica orchestrator (no partitioning)
- Script sandbox via child_process only (NOT production-safe)
- Webhook secret stored as plaintext in DB
- HS256 JWT (consider RS256 for production)

See [TRADEOFFS.md](docs/TRADEOFFS.md) for the full list.

## License

MIT
