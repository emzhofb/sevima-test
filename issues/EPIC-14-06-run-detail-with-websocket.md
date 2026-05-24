# [Epic-14] Run detail page with live WebSocket updates

**Labels**: `epic-14`, `area-frontend`
**Estimate**: 3 jam
**Depends on**: #105, #91

## Context

Page show run + step list, real-time update via WebSocket.

## Acceptance Criteria

- [ ] `/runs/:id` show run status, step list dengan status badge
- [ ] WebSocket connect ke `/ws?token=...`
- [ ] Subscribe ke `run_id` lewat WS message
- [ ] Update step status saat event diterima
- [ ] Show timestamps + duration per step

## Implementation Hints

```tsx
// src/pages/RunDetailPage.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [stepStatuses, setStepStatuses] = useState<Record<string, string>>({});
  const [runStatus, setRunStatus] = useState<string | null>(null);

  const { data: run } = useQuery({
    queryKey: ['run', id],
    queryFn: () => api(`/runs/${id}`),
  });

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('token');
    const ws = new WebSocket(`/ws?token=${token}`);

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: 'subscribe', run_id: id }));
    };

    ws.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.run_id !== id) return;

      if (event.type === 'STEP_STARTED') {
        setStepStatuses((prev) => ({ ...prev, [event.step_id]: 'RUNNING' }));
      } else if (event.type === 'STEP_SUCCEEDED') {
        setStepStatuses((prev) => ({ ...prev, [event.step_id]: 'SUCCEEDED' }));
      } else if (event.type === 'STEP_FAILED') {
        setStepStatuses((prev) => ({ ...prev, [event.step_id]: 'FAILED' }));
      } else if (event.type.startsWith('RUN_')) {
        setRunStatus(event.type.replace('RUN_', ''));
      }
    };

    return () => ws.close();
  }, [id]);

  if (!run) return <p>Loading…</p>;

  // Initialize stepStatuses from server
  useEffect(() => {
    if (run.step_runs) {
      const initial: Record<string, string> = {};
      for (const sr of run.step_runs) initial[sr.step_id] = sr.status;
      setStepStatuses(initial);
      setRunStatus(run.status);
    }
  }, [run]);

  return (
    <div>
      <h1>Run {id}</h1>
      <p>Status: <Badge status={runStatus ?? run.status} /></p>

      <h2>Steps</h2>
      <table>
        <thead>
          <tr>
            <th>Step ID</th><th>Status</th><th>Attempt</th>
          </tr>
        </thead>
        <tbody>
          {run.step_runs?.map((sr: any) => (
            <tr key={sr.id}>
              <td>{sr.step_id}</td>
              <td><Badge status={stepStatuses[sr.step_id] ?? sr.status} /></td>
              <td>{sr.attempt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    RUNNING: '#3b82f6', SUCCEEDED: '#10b981', FAILED: '#ef4444',
    PENDING: '#94a3b8', READY: '#94a3b8', CANCELLED: '#6b7280',
  };
  return (
    <span style={{ background: colors[status] ?? '#999', color: 'white', padding: '2px 8px', borderRadius: 4 }}>
      {status}
    </span>
  );
}
```

## Files Involved

- `packages/web/src/pages/RunDetailPage.tsx`

## How to Verify

```bash
pnpm dev:all
# Trigger run, lihat step status update real-time
```
