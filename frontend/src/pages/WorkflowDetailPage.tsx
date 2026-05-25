import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { DagView } from '../components/DagView';

interface WorkflowVersion {
  id: string;
  version: number;
  definition: {
    steps: any[];
  };
  created_at: string;
}

interface WorkflowDetail {
  id: string;
  name: string;
  current_version: number;
  version: WorkflowVersion;
  created_at: string;
  updated_at: string;
}

export function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [parsedSteps, setParsedSteps] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  const { data: workflow, isLoading, error } = useQuery<WorkflowDetail>({
    queryKey: ['workflows', id],
    queryFn: () => api(`/workflows/${id}`),
  });

  // Sync state with fetched workflow definition
  useEffect(() => {
    if (workflow?.version?.definition) {
      const defStr = JSON.stringify(workflow.version.definition, null, 2);
      setJsonText(defStr);
      setParsedSteps(workflow.version.definition.steps || []);
    }
  }, [workflow]);

  // Real-time validation and DAG updates as user types
  const handleJsonChange = (val: string) => {
    setJsonText(val);
    try {
      const parsed = JSON.parse(val);
      if (parsed && Array.isArray(parsed.steps)) {
        setParsedSteps(parsed.steps);
        setJsonError(null);
      } else {
        setJsonError('Workflow definition must contain a "steps" array.');
      }
    } catch (e: any) {
      setJsonError(`Invalid JSON: ${e.message}`);
    }
  };

  const updateMutation = useMutation({
    mutationFn: (newDefinition: any) =>
      api(`/workflows/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ definition: newDefinition }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', id] });
      setIsEditing(false);
      setJsonError(null);
    },
    onError: (err: any) => {
      setJsonError(err.body?.error || err.body?.message || 'Failed to save workflow.');
    },
  });

  const triggerMutation = useMutation({
    mutationFn: () =>
      api(`/workflows/${id}/runs`, {
        method: 'POST',
        body: JSON.stringify({ input: {} }),
      }),
    onSuccess: (run) => {
      navigate(`/runs/${run.run_id}`);
    },
  });

  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonText);
      updateMutation.mutate(parsed);
    } catch (e) {
      setJsonError('Cannot save invalid JSON.');
    }
  };

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading workflow details...</div>;
  }

  if (error || !workflow) {
    return (
      <div className="glass" style={{ padding: 24, border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--danger)' }}>
        Workflow not found or access denied.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{workflow.name}</h1>
            <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
              Version {workflow.current_version}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            ID: <span style={{ fontFamily: 'monospace' }}>{workflow.id}</span> • Created {new Date(workflow.created_at).toLocaleString()}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="secondary"
            onClick={() => {
              if (isEditing) {
                // Cancel edit
                if (workflow?.version?.definition) {
                  setJsonText(JSON.stringify(workflow.version.definition, null, 2));
                  setParsedSteps(workflow.version.definition.steps || []);
                }
                setJsonError(null);
                setIsEditing(false);
              } else {
                setIsEditing(true);
              }
            }}
          >
            {isEditing ? 'Cancel Edit' : 'Edit Definition'}
          </button>

          <button
            onClick={() => triggerMutation.mutate()}
            disabled={triggerMutation.isPending}
          >
            {triggerMutation.isPending ? 'Starting...' : 'Trigger Run'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isEditing ? '1fr 1.2fr' : '1fr', gap: 24, alignItems: 'stretch' }}>
        {/* Editor sidebar if editing */}
        {isEditing && (
          <div className="glass" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, height: 'calc(100vh - 220px)', minHeight: 450 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>JSON Definition</h3>
              <button
                style={{ padding: '6px 14px', fontSize: 13 }}
                onClick={handleSave}
                disabled={updateMutation.isPending || !!jsonError}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Draft'}
              </button>
            </div>

            <textarea
              style={{
                flex: 1,
                fontFamily: 'monospace',
                fontSize: 12,
                background: 'rgba(0, 0, 0, 0.5)',
                color: '#e5e7eb',
                lineHeight: 1.5,
                resize: 'none',
              }}
              value={jsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
            />

            {jsonError && (
              <div style={{ fontSize: 13, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 14px', borderRadius: 8, color: 'var(--danger)', wordBreak: 'break-all' }}>
                {jsonError}
              </div>
            )}
          </div>
        )}

        {/* Visual Graph View */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Workflow Topology (DAG)</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Drag nodes to customize positioning.
            </span>
          </div>

          <div style={{ flex: 1, minHeight: isEditing ? 'auto' : 500 }}>
            <DagView steps={parsedSteps} />
          </div>
        </div>
      </div>
    </div>
  );
}
