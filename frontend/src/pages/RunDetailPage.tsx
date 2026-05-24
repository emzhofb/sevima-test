import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getToken } from '../lib/auth';
import { DagView } from '../components/DagView';

interface StepRun {
  id: string;
  step_id: string;
  status: 'PENDING' | 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';
  attempt: number;
  output?: any;
  error?: string;
  started_at?: string;
  finished_at?: string;
}

interface RunDetail {
  id: string;
  workflow_id: string;
  version_id: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT';
  input: any;
  trigger_type: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  step_runs: StepRun[];
}

interface Workflow {
  id: string;
  name: string;
  version: {
    definition: {
      steps: any[];
    };
  };
}

export function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState<string>('0s');
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  // WS status indicator
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  // Fetch run detail
  const { data: run, isLoading: isRunLoading, error: runError } = useQuery<RunDetail>({
    queryKey: ['runs', id],
    queryFn: () => api(`/runs/${id}`),
  });

  // Fetch associated workflow to get step definitions for DAG
  const { data: workflow } = useQuery<Workflow>({
    queryKey: ['workflows', run?.workflow_id],
    queryFn: () => api(`/workflows/${run?.workflow_id}`),
    enabled: !!run?.workflow_id,
  });

  // Mutation to cancel a run
  const cancelMutation = useMutation({
    mutationFn: () => api(`/runs/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs', id] });
    },
  });

  // Calculate and update duration elapsed
  useEffect(() => {
    if (!run) return;
    const start = run.started_at ? new Date(run.started_at).getTime() : null;
    const end = run.finished_at ? new Date(run.finished_at).getTime() : null;

    if (!start) {
      setElapsed('0s');
      return;
    }

    const updateTime = () => {
      const currentEnd = end ?? Date.now();
      const diffMs = currentEnd - start;
      if (diffMs <= 0) {
        setElapsed('0s');
        return;
      }
      const totalSec = diffMs / 1000;
      if (totalSec < 60) {
        setElapsed(`${totalSec.toFixed(1)}s`);
      } else {
        const mins = Math.floor(totalSec / 60);
        const secs = Math.floor(totalSec % 60);
        setElapsed(`${mins}m ${secs}s`);
      }
    };

    updateTime();

    if (run.status === 'RUNNING' || run.status === 'PENDING') {
      const interval = setInterval(updateTime, 100);
      return () => clearInterval(interval);
    }
  }, [run]);

  // WebSocket Live Sync
  useEffect(() => {
    if (!id) return;
    const token = getToken();
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

    let ws: WebSocket;
    let reconnectTimeout: any;

    const connect = () => {
      setWsStatus('connecting');
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsStatus('connected');
        // Subscribe to run events
        ws.send(JSON.stringify({ action: 'subscribe', run_id: id }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          // Invalidate and refetch runs on any relevant real-time event
          if (msg.run_id === id) {
            queryClient.invalidateQueries({ queryKey: ['runs', id] });
            queryClient.invalidateQueries({ queryKey: ['runs', 'recent'] });
            queryClient.invalidateQueries({ queryKey: ['runs', 'stats'] });
          }
        } catch (e) {
          // ignore parsing issues
        }
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        // Attempt reconnect in 3s
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [id, queryClient]);

  if (isRunLoading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading run execution...</div>;
  }

  if (runError || !run) {
    return (
      <div className="glass" style={{ padding: 24, border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--danger)' }}>
        Run execution not found or access denied.
      </div>
    );
  }

  // Construct status map for steps
  const stepStatusMap: Record<string, string> = {};
  if (run.step_runs) {
    for (const sr of run.step_runs) {
      stepStatusMap[sr.step_id] = sr.status;
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'SUCCEEDED': return 'rgba(16, 185, 129, 0.15)';
      case 'FAILED': return 'rgba(239, 68, 68, 0.15)';
      case 'RUNNING': return 'rgba(99, 102, 241, 0.15)';
      case 'PENDING': return 'rgba(245, 158, 11, 0.15)';
      case 'CANCELLED': return 'rgba(156, 163, 175, 0.15)';
      case 'TIMED_OUT': return 'rgba(245, 158, 11, 0.15)';
      default: return 'rgba(255, 255, 255, 0.08)';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'SUCCEEDED': return 'var(--success)';
      case 'FAILED': return 'var(--danger)';
      case 'RUNNING': return 'var(--accent)';
      case 'PENDING': return 'var(--warning)';
      case 'CANCELLED': return 'var(--text-muted)';
      case 'TIMED_OUT': return 'var(--warning)';
      default: return 'var(--text-muted)';
    }
  };

  const toggleStepExpand = (stepId: string) => {
    setExpandedSteps(prev => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header / Info bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>Run: {run.id.slice(0, 18)}...</h1>
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
            <span style={{
              fontSize: 11,
              padding: '2px 6px',
              borderRadius: 4,
              background: wsStatus === 'connected' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
              color: wsStatus === 'connected' ? 'var(--success)' : 'var(--warning)',
              border: `1px solid ${wsStatus === 'connected' ? 'var(--success)' : 'var(--warning)'}22`
            }}>
              {wsStatus === 'connected' ? 'Live connected' : 'Live connecting...'}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Workflow:{' '}
            <Link to={`/workflows/${run.workflow_id}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              {workflow?.name || run.workflow_id}
            </Link>
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Duration elapsed</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: 'var(--text)' }}>
              {elapsed}
            </div>
          </div>

          {(run.status === 'RUNNING' || run.status === 'PENDING') && (
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              style={{ background: 'var(--danger)', padding: '10px 18px', fontSize: 14 }}
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Execution'}
            </button>
          )}
        </div>
      </div>

      {/* DAG View */}
      {workflow?.version?.definition?.steps && (
        <div style={{ height: 320, width: '100%' }}>
          <DagView steps={workflow.version.definition.steps} stepRuns={stepStatusMap} />
        </div>
      )}

      {/* Steps Execution logs & list */}
      <div className="glass" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Execution Steps</h2>

        {!run.step_runs || run.step_runs.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
            No steps executed yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {run.step_runs.map((sr) => {
              const stepDef = workflow?.version?.definition?.steps?.find((s: any) => s.id === sr.step_id);
              const isExpanded = !!expandedSteps[sr.id];
              const stepDuration = sr.started_at && sr.finished_at
                ? `${((new Date(sr.finished_at).getTime() - new Date(sr.started_at).getTime()) / 1000).toFixed(1)}s`
                : sr.started_at ? 'running...' : '-';

              return (
                <div
                  key={sr.id}
                  className="glass"
                  style={{
                    padding: 16,
                    borderLeft: `4px solid ${getStatusTextColor(sr.status)}`,
                    background: 'rgba(255, 255, 255, 0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>
                        {stepDef?.name || sr.step_id}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        ID: <span style={{ fontFamily: 'monospace' }}>{sr.step_id}</span> • Type: {stepDef?.type || 'UNKNOWN'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        Duration: {stepDuration}
                      </div>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          background: getStatusBadgeColor(sr.status),
                          color: getStatusTextColor(sr.status),
                        }}
                      >
                        {sr.status}
                      </span>

                      {(sr.output || sr.error) && (
                        <button
                          className="secondary"
                          onClick={() => toggleStepExpand(sr.id)}
                          style={{ padding: '4px 8px', fontSize: 11 }}
                        >
                          {isExpanded ? 'Hide Payload' : 'Show Payload'}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      {sr.output && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Output Payload:</span>
                          <pre style={{ background: 'rgba(0,0,0,0.4)', padding: 12, borderRadius: 6, color: '#10b981', overflowX: 'auto', fontFamily: 'monospace' }}>
                            {JSON.stringify(sr.output, null, 2)}
                          </pre>
                        </div>
                      )}
                      {sr.error && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Error Log:</span>
                          <pre style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239,68,68,0.2)', padding: 12, borderRadius: 6, color: 'var(--danger)', overflowX: 'auto', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                            {sr.error}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
