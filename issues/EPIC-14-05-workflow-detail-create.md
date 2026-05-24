# [Epic-14] Workflow detail page + JSON editor

**Labels**: `epic-14`, `area-frontend`
**Estimate**: 3 jam
**Depends on**: #105

## Context

Page untuk view + edit workflow. Pakai textarea sederhana atau Monaco editor.

## Acceptance Criteria

- [ ] `/workflows/:id` show name, current version, definition (JSON)
- [ ] Button "Edit" → masuk mode edit dengan textarea
- [ ] Save → PATCH endpoint
- [ ] Button "Trigger Run" → POST /workflows/:id/runs
- [ ] Button "Rollback to v..." (kalau >1 version)

## Implementation Hints

```tsx
// src/pages/WorkflowDetailPage.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const { data: wf } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => api(`/workflows/${id}`),
  });

  const update = useMutation({
    mutationFn: (definition: any) => api(`/workflows/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ definition }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
      setEditing(false);
    },
  });

  const trigger = useMutation({
    mutationFn: () => api(`/workflows/${id}/runs`, {
      method: 'POST',
      body: JSON.stringify({ input: {} }),
    }),
    onSuccess: (data) => navigate(`/runs/${data.run_id}`),
  });

  if (!wf) return <p>Loading…</p>;

  return (
    <div>
      <h1>{wf.name}</h1>
      <p>Version: {wf.current_version}</p>
      <button onClick={() => trigger.mutate()}>Trigger Run</button>

      {editing ? (
        <>
          <textarea
            rows={20}
            cols={80}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button onClick={() => {
            try {
              const def = JSON.parse(draft);
              update.mutate(def);
            } catch (err) {
              alert('Invalid JSON');
            }
          }}>
            Save
          </button>
          <button onClick={() => setEditing(false)}>Cancel</button>
        </>
      ) : (
        <>
          <pre>{JSON.stringify(wf.version.definition, null, 2)}</pre>
          <button onClick={() => {
            setDraft(JSON.stringify(wf.version.definition, null, 2));
            setEditing(true);
          }}>
            Edit
          </button>
        </>
      )}
    </div>
  );
}
```

## Files Involved

- `packages/web/src/pages/WorkflowDetailPage.tsx`

## How to Verify

```bash
pnpm -F @flowforge/web dev
# Click workflow row, edit definition, save, trigger run
```
