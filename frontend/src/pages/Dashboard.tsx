import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { HealthPanel } from '../components/HealthPanel';
import { api } from '../lib/api';

interface Run {
  id: string;
  workflow_id: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT';
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

interface RunsResponse {
  items: Run[];
  total: number;
  page: number;
  pageSize: number;
}

export function Dashboard() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery<RunsResponse>({
    queryKey: ['runs', 'recent'],
    queryFn: () => api('/runs?pageSize=10'),
    refetchInterval: 10000, // refresh runs list every 10 seconds too
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'SUCCEEDED': return 'rgba(16, 185, 129, 0.15)';
      case 'FAILED': return 'rgba(239, 68, 68, 0.15)';
      case 'RUNNING': return 'rgba(99, 102, 241, 0.15)';
      case 'PENDING': return 'rgba(245, 158, 11, 0.15)';
      default: return 'rgba(255, 255, 255, 0.08)';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'SUCCEEDED': return 'var(--success)';
      case 'FAILED': return 'var(--danger)';
      case 'RUNNING': return 'var(--accent)';
      case 'PENDING': return 'var(--warning)';
      default: return 'var(--text-muted)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, background: 'linear-gradient(to right, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Dashboard
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>
          Live metrics and recent executions across your active tenant.
        </p>
      </div>

      <HealthPanel />

      <div className="glass" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Recent Executions</h2>

        {isLoading ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading executions...
          </div>
        ) : !data?.items || data.items.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            No runs recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 0 }}>Run ID</th>
                  <th>Workflow ID</th>
                  <th>Status</th>
                  <th>Started At</th>
                  <th>Finished At</th>
                  <th style={{ paddingRight: 0, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((run) => (
                  <tr
                    key={run.id}
                    onClick={() => navigate(`/runs/${run.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ paddingLeft: 0, fontWeight: 600, color: 'var(--accent)' }}>
                      {run.id.slice(0, 8)}...
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{run.workflow_id}</td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          background: getStatusBadgeColor(run.status),
                          color: getStatusTextColor(run.status),
                          border: `1px solid ${getStatusTextColor(run.status)}22`
                        }}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td>{run.started_at ? new Date(run.started_at).toLocaleString() : '-'}</td>
                    <td>{run.finished_at ? new Date(run.finished_at).toLocaleString() : '-'}</td>
                    <td style={{ paddingRight: 0, textAlign: 'right' }}>
                      <button
                        className="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/runs/${run.id}`);
                        }}
                        style={{ padding: '6px 12px', fontSize: 13 }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
