# [Epic-14] Workflow list page

**Labels**: `epic-14`, `area-frontend`
**Estimate**: 2 jam
**Depends on**: #103, #105

## Context

Tabel workflow dengan pagination + search.

## Acceptance Criteria

- [ ] Page `/workflows` show table: name, current_version, updated_at
- [ ] Pagination
- [ ] Search by name
- [ ] Click row → navigate to detail

## Implementation Hints

```bash
pnpm -F @flowforge/web add react-router-dom @tanstack/react-query
```

Setup React Query + Router:

```tsx
// src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </BrowserRouter>,
);
```

```tsx
// src/pages/WorkflowsPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export function WorkflowsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['workflows', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search) params.set('name', search);
      return api(`/workflows?${params}`);
    },
  });

  if (isLoading) return <p>Loading…</p>;

  return (
    <div>
      <h1>Workflows</h1>
      <input
        value={search}
        onChange={(e) => { setPage(1); setSearch(e.target.value); }}
        placeholder="Search by name"
      />
      <table>
        <thead><tr><th>Name</th><th>Version</th><th>Updated</th></tr></thead>
        <tbody>
          {data?.items?.map((w: any) => (
            <tr key={w.id} onClick={() => navigate(`/workflows/${w.id}`)} style={{ cursor: 'pointer' }}>
              <td>{w.name}</td>
              <td>{w.current_version}</td>
              <td>{new Date(w.updated_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
        <span>Page {page}</span>
        <button onClick={() => setPage(p => p + 1)}>Next</button>
      </div>
    </div>
  );
}
```

## Files Involved

- `packages/web/src/pages/WorkflowsPage.tsx`
- `packages/web/src/main.tsx` (router setup)

## How to Verify

```bash
pnpm -F @flowforge/web dev
# Login, navigate /workflows, see list
```
