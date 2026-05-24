# [Epic-14] Global health panel

**Labels**: `epic-14`, `area-frontend`, `stretch`
**Estimate**: 2 jam
**Depends on**: #105

## Context

Dashboard show: jumlah run aktif, success/failure rate 24h, avg duration.

## Acceptance Criteria

- [ ] Endpoint API `/runs/stats` return aggregated stats
- [ ] Component `<HealthPanel />` render 3 cards
- [ ] Auto refresh setiap 10 detik

## Implementation Hints

API endpoint:

```ts
fastify.get('/runs/stats', { preHandler: requireRole('VIEWER') }, async (req) => {
  const { tenant_id } = req.ctx!;
  const sinceCutoff = new Date(Date.now() - 24 * 3600_000);

  const result = await fastify.db.query(
    `SELECT
       status, COUNT(*) as count,
       AVG(EXTRACT(EPOCH FROM (finished_at - started_at))) as avg_duration_sec
     FROM runs
     WHERE tenant_id = $1 AND started_at >= $2
     GROUP BY status`,
    [tenant_id, sinceCutoff],
  );

  const byStatus: Record<string, { count: number; avg_duration_sec: number }> = {};
  for (const r of result.rows) {
    byStatus[r.status] = { count: Number(r.count), avg_duration_sec: Number(r.avg_duration_sec ?? 0) };
  }

  const active = (await fastify.db.query(
    `SELECT COUNT(*)::int as c FROM runs WHERE tenant_id = $1 AND status IN ('PENDING','RUNNING')`,
    [tenant_id],
  )).rows[0].c;

  return { active, by_status: byStatus };
});
```

Component:

```tsx
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function HealthPanel() {
  const { data } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api('/runs/stats'),
    refetchInterval: 10000,
  });

  if (!data) return null;

  const total = Object.values(data.by_status as Record<string, any>).reduce(
    (sum: number, s: any) => sum + s.count, 0,
  );
  const successRate = total > 0
    ? (data.by_status?.SUCCEEDED?.count ?? 0) / total * 100
    : 0;

  return (
    <div className="health-panel">
      <Card title="Active Runs" value={data.active} />
      <Card title="Success Rate (24h)" value={`${successRate.toFixed(1)}%`} />
      <Card title="Avg Duration" value={`${data.by_status?.SUCCEEDED?.avg_duration_sec?.toFixed(1) ?? '0'}s`} />
    </div>
  );
}
```

## Files Involved

- Update API
- `packages/web/src/components/HealthPanel.tsx`

## How to Verify

Trigger beberapa run, lihat stats update.
