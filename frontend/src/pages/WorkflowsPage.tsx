import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface Workflow {
  id: string;
  name: string;
  version: number;
  definition: any;
  created_at: string;
  updated_at: string;
}

interface WorkflowsResponse {
  items: Workflow[];
  total: number;
  page: number;
  pageSize: number;
}

export function WorkflowsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading, error } = useQuery<WorkflowsResponse>({
    queryKey: ['workflows', page, search],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (search) params.append('name', search);
      return api(`/workflows?${params.toString()}`);
    },
  });

  // Mutation to create a new blank workflow for convenience
  const createMutation = useMutation({
    mutationFn: () => {
      const name = `New Workflow ${Date.now().toString().slice(-4)}`;
      return api('/workflows', {
        method: 'POST',
        body: JSON.stringify({
          name,
          definition: {
            name,
            timeout_sec: 60,
            steps: [
              {
                id: 'start',
                type: 'HTTP',
                depends_on: [],
                config: {
                  url: 'https://httpbin.org/get',
                  method: 'GET',
                },
                continue_on_failure: false,
              },
            ],
          },
        }),
      });
    },
    onSuccess: (newWf) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      navigate(`/workflows/${newWf.id}`);
    },
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1); // Reset to first page on search
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, background: 'linear-gradient(to right, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Workflows
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>
            Design, edit, and orchestrate automation workflows.
          </p>
        </div>
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {createMutation.isPending ? 'Creating...' : '+ Create Workflow'}
        </button>
      </div>

      <div className="glass" style={{ padding: 24 }}>
        <div style={{ marginBottom: 20, maxWidth: 400 }}>
          <input
            type="text"
            placeholder="Search workflows by name..."
            value={search}
            onChange={handleSearchChange}
            style={{ fontSize: 14 }}
          />
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', padding: 10, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            Error fetching workflows. Please try again.
          </div>
        )}

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            Loading workflows...
          </div>
        ) : !data?.items || data.items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            No workflows found. Add a new one to get started!
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 0 }}>Name</th>
                    <th>ID</th>
                    <th>Current Version</th>
                    <th>Last Updated</th>
                    <th style={{ paddingRight: 0, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((wf) => (
                    <tr
                      key={wf.id}
                      onClick={() => navigate(`/workflows/${wf.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ paddingLeft: 0, fontWeight: 600, color: 'var(--text)' }}>
                        {wf.name}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{wf.id}</td>
                      <td>
                        <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                          v{wf.version}
                        </span>
                      </td>
                      <td>{new Date(wf.updated_at).toLocaleString()}</td>
                      <td style={{ paddingRight: 0, textAlign: 'right' }}>
                        <button
                          className="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/workflows/${wf.id}`);
                          }}
                          style={{ padding: '6px 12px', fontSize: 13 }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, flexWrap: 'wrap', gap: 12 }}>
                <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                  Showing page {page} of {totalPages} ({data.total} total items)
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="secondary"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{ padding: '8px 16px', fontSize: 13 }}
                  >
                    Previous
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    style={{ padding: '8px 16px', fontSize: 13 }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
