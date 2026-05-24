# [Epic-15] Full docker-compose with all services

**Labels**: `epic-15`, `area-infra`
**Estimate**: 2 jam
**Depends on**: #109

## Context

`docker-compose up` should bring up entire stack: api, orchestrator, worker, scheduler, realtime, postgres, redis, web.

## Acceptance Criteria

- [ ] All services defined
- [ ] Healthcheck per service
- [ ] Migration runs once before api starts
- [ ] Frontend accessible at http://localhost:5173
- [ ] API at http://localhost:3000

## Implementation Hints

```yaml
version: '3.9'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: flowforge
      POSTGRES_USER: flowforge
      POSTGRES_PASSWORD: flowforge_dev
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: pg_isready -U flowforge
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    healthcheck:
      test: redis-cli ping
      interval: 5s

  migrate:
    build: { context: ., dockerfile: Dockerfile }
    command: pnpm migrate:up
    environment:
      DATABASE_URL: postgres://flowforge:flowforge_dev@postgres:5432/flowforge
    depends_on:
      postgres:
        condition: service_healthy
    restart: 'no'

  api:
    build: { context: ., dockerfile: Dockerfile }
    environment:
      SERVICE: api
      DATABASE_URL: postgres://flowforge:flowforge_dev@postgres:5432/flowforge
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev-jwt-secret-at-least-32-characters-long
      PORT: 3000
    ports: ['3000:3000']
    depends_on:
      migrate:
        condition: service_completed_successfully
    healthcheck:
      test: wget -q --spider http://localhost:3000/health || exit 1
      interval: 10s

  orchestrator:
    build: { context: ., dockerfile: Dockerfile }
    environment:
      SERVICE: orchestrator
      DATABASE_URL: postgres://flowforge:flowforge_dev@postgres:5432/flowforge
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev-jwt-secret-at-least-32-characters-long
    depends_on:
      api:
        condition: service_healthy

  worker:
    build: { context: ., dockerfile: Dockerfile }
    environment:
      SERVICE: worker
      DATABASE_URL: postgres://flowforge:flowforge_dev@postgres:5432/flowforge
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev-jwt-secret-at-least-32-characters-long
    depends_on:
      api:
        condition: service_healthy

  scheduler:
    build: { context: ., dockerfile: Dockerfile }
    environment:
      SERVICE: scheduler
      DATABASE_URL: postgres://flowforge:flowforge_dev@postgres:5432/flowforge
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev-jwt-secret-at-least-32-characters-long
    depends_on:
      api:
        condition: service_healthy

  realtime:
    build: { context: ., dockerfile: Dockerfile }
    environment:
      SERVICE: realtime
      DATABASE_URL: postgres://flowforge:flowforge_dev@postgres:5432/flowforge
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev-jwt-secret-at-least-32-characters-long
    ports: ['3001:3001']
    depends_on:
      api:
        condition: service_healthy

  web:
    build: { context: ., dockerfile: packages/web/Dockerfile }
    ports: ['5173:5173']
    depends_on:
      - api

volumes:
  pgdata:
```

## Files Involved

- `docker-compose.yml`
- `packages/web/Dockerfile`

## How to Verify

```bash
docker compose up --build
# Akses http://localhost:5173
```
