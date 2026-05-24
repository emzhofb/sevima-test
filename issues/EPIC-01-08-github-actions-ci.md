# [Epic-01] GitHub Actions CI pipeline

**Labels**: `epic-01`, `area-infra`
**Estimate**: 1 jam
**Depends on**: #3 (eslint), #4 (vitest)

## Context

Setup CI yang jalan di setiap PR: typecheck, lint, test, build.

## Acceptance Criteria

- [ ] `.github/workflows/ci.yml` ada
- [ ] Job berurutan: install → typecheck → lint → test → build
- [ ] Cache pnpm store untuk speed up
- [ ] CI gagal kalau salah satu step gagal

## Implementation Hints

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: flowforge_test
          POSTGRES_USER: flowforge
          POSTGRES_PASSWORD: flowforge
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Test
        run: pnpm test
        env:
          DATABASE_URL: postgres://flowforge:flowforge@localhost:5432/flowforge_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret-at-least-32-characters-long-enough

      - name: Build
        run: pnpm build
```

## Files Involved

- `.github/workflows/ci.yml`

## How to Verify

Push branch + buka PR → cek tab Actions, semua step hijau.
