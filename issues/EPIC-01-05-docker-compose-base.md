# [Epic-01] docker-compose with PostgreSQL + Redis

**Labels**: `epic-01`, `area-infra`
**Estimate**: 1 jam
**Depends on**: #1

## Context

Local dev environment butuh PostgreSQL (source of truth) dan Redis (broker + cache + rate limit).

## Acceptance Criteria

- [ ] `docker-compose.yml` mendefinisikan service `postgres` dan `redis`
- [ ] Healthcheck pada masing-masing service
- [ ] Volume persistent (data tidak hilang saat container restart)
- [ ] `.env.example` berisi variabel koneksi
- [ ] `docker compose up -d` sukses dan service `healthy`

## Implementation Hints

`docker-compose.yml`:

```yaml
version: '3.9'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: flowforge
      POSTGRES_USER: flowforge
      POSTGRES_PASSWORD: flowforge_dev
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U flowforge']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

`.env.example`:

```
DATABASE_URL=postgres://flowforge:flowforge_dev@localhost:5432/flowforge
REDIS_URL=redis://localhost:6379
JWT_SECRET=replace-me-with-long-random-string
NODE_ENV=development
```

## Files Involved

- `docker-compose.yml`
- `.env.example`

## How to Verify

```bash
docker compose up -d
docker compose ps
# postgres dan redis status: healthy
```
