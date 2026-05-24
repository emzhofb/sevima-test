# [Epic-16] Coverage report + threshold gate

**Labels**: `epic-16`, `area-testing`
**Estimate**: 1 jam
**Depends on**: #4 (vitest)

## Context

Vitest coverage > 75% line untuk core packages. Gate di CI agar PR yang turunkan coverage gagal.

## Acceptance Criteria

- [ ] `vitest.config.ts` punya `coverage.thresholds`
- [ ] Threshold: line >= 75%, branch >= 65% untuk packages: parser, auth, orchestrator, worker
- [ ] CI fail kalau di bawah threshold

## Implementation Hints

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts', '**/dist/**', '**/server.ts'],
      thresholds: {
        lines: 75,
        branches: 65,
        functions: 75,
        statements: 75,
      },
    },
  },
});
```

CI step:

```yaml
- name: Test with coverage
  run: pnpm test:coverage
```

## Files Involved

- `vitest.config.ts`
- `.github/workflows/ci.yml`

## How to Verify

```bash
pnpm test:coverage
# Lihat % di output
```
