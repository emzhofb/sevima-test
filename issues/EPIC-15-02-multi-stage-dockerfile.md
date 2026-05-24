# [Epic-15] Multi-stage Dockerfile for backend

**Labels**: `epic-15`, `area-infra`
**Estimate**: 1.5 jam
**Depends on**: None

## Context

Multi-stage build: builder (build TS) + runner (slim production image).

## Acceptance Criteria

- [ ] `Dockerfile` multi-stage di root
- [ ] Image final < 200 MB
- [ ] `docker build .` sukses
- [ ] Run tanpa error

## Implementation Hints

```dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/

RUN pnpm install --frozen-lockfile
RUN pnpm -r build

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=builder /app/packages/ ./packages/

RUN pnpm install --prod --frozen-lockfile

# Choose service to run via env (default api)
ENV SERVICE=api
EXPOSE 3000

CMD ["sh", "-c", "node packages/${SERVICE}/dist/server.js"]
```

`.dockerignore`:

```
node_modules
**/node_modules
**/dist
.git
.env
coverage
```

## Files Involved

- `Dockerfile`
- `.dockerignore`

## How to Verify

```bash
docker build -t flowforge:test .
docker run --rm -e SERVICE=api -e DATABASE_URL=... flowforge:test
```
