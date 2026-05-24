# [Epic-15] Prometheus metrics endpoint

**Labels**: `epic-15`, `area-infra`, `stretch`
**Estimate**: 2 jam
**Depends on**: #50

## Context

Endpoint `/metrics` untuk scraping Prometheus. Pakai `prom-client`.

## Acceptance Criteria

- [ ] Endpoint `/metrics` di setiap service
- [ ] Counter: `flowforge_runs_total{status}`, `flowforge_rate_limit_hit_total{tenant}`
- [ ] Histogram: `flowforge_http_request_duration_ms{method,route,status}`
- [ ] Gauge: `flowforge_active_runs`

## Implementation Hints

```bash
pnpm add -F @flowforge/api prom-client
```

```ts
// packages/shared/src/metrics.ts
import client from 'prom-client';

client.collectDefaultMetrics();

export const httpDuration = new client.Histogram({
  name: 'flowforge_http_request_duration_ms',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status'],
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
});

export const runsTotal = new client.Counter({
  name: 'flowforge_runs_total',
  help: 'Total runs',
  labelNames: ['status', 'trigger_type'],
});

export const activeRuns = new client.Gauge({
  name: 'flowforge_active_runs',
  help: 'Currently active runs',
});

export const registry = client.register;
```

```ts
// In Fastify app
app.addHook('onResponse', async (req, reply) => {
  const route = (req.routeOptions?.url ?? req.url).split('?')[0];
  httpDuration.observe(
    { method: req.method, route, status: reply.statusCode },
    reply.elapsedTime,
  );
});

app.get('/metrics', async (req, reply) => {
  reply.type(registry.contentType);
  return registry.metrics();
});
```

## Files Involved

- `packages/shared/src/metrics.ts`
- Update `packages/api/src/app.ts`

## How to Verify

```bash
curl http://localhost:3000/metrics
# Output prometheus format
```
