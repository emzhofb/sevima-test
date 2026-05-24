import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface StatsResponse {
  active: number;
  by_status: Record<string, { count: number; avg_duration_sec: number }>;
}

export function HealthPanel() {
  const { data, isLoading, error } = useQuery<StatsResponse>({
    queryKey: ['runs', 'stats'],
    queryFn: () => api('/runs/stats'),
    refetchInterval: 10000, // 10 seconds
  });

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass" style={{ height: 140, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ width: 120, height: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 12 }}></div>
            <div style={{ width: 80, height: 32, background: 'rgba(255,255,255,0.05)', borderRadius: 6 }}></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass" style={{ padding: 20, border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--danger)' }}>
        Failed to load system health statistics.
      </div>
    );
  }

  const activeCount = data?.active ?? 0;
  const byStatus = data?.by_status ?? {};

  const succeeded = byStatus['SUCCEEDED']?.count ?? 0;
  const failed = byStatus['FAILED']?.count ?? 0;
  const cancelled = byStatus['CANCELLED']?.count ?? 0;
  const timedOut = byStatus['TIMED_OUT']?.count ?? 0;
  const totalFinished = succeeded + failed + cancelled + timedOut;

  const successRate = totalFinished > 0 ? (succeeded / totalFinished) * 100 : 0;
  const avgDuration = byStatus['SUCCEEDED']?.avg_duration_sec ?? 0;

  const formatDuration = (sec: number) => {
    if (sec <= 0) return '0s';
    if (sec < 60) return `${sec.toFixed(1)}s`;
    const mins = Math.floor(sec / 60);
    const remainingSecs = sec % 60;
    return `${mins}m ${remainingSecs.toFixed(0)}s`;
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
      {/* Active Runs Card */}
      <div className="glass card-hover" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8, transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative', overflow: 'hidden' }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>Active Runs</div>
        <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--text)' }}>
          {activeCount}
        </div>
        <div style={{ fontSize: 12, color: 'var(--accent)' }}>Currently processing</div>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: 'var(--accent)' }}></div>
      </div>

      {/* Success Rate Card */}
      <div className="glass card-hover" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8, transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative', overflow: 'hidden' }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>Success Rate (24h)</div>
        <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--text)' }}>
          {totalFinished > 0 ? `${successRate.toFixed(1)}%` : 'N/A'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {succeeded} of {totalFinished} succeeded
        </div>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: totalFinished === 0 ? 'var(--text-muted)' : successRate > 90 ? 'var(--success)' : 'var(--warning)' }}></div>
      </div>

      {/* Avg Duration Card */}
      <div className="glass card-hover" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8, transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative', overflow: 'hidden' }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>Avg Success Duration (24h)</div>
        <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--text)' }}>
          {formatDuration(avgDuration)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>For successful runs</div>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: 'var(--warning)' }}></div>
      </div>
    </div>
  );
}
