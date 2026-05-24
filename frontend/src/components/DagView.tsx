import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';

interface Step {
  id: string;
  name: string;
  type: string;
  depends_on?: string[];
}

interface DagViewProps {
  steps: Step[];
  stepRuns?: Record<string, string>; // Maps step_id to status
}

function getStatusBg(status: string) {
  switch (status) {
    case 'SUCCEEDED':
      return 'rgba(16, 185, 129, 0.15)';
    case 'FAILED':
      return 'rgba(239, 68, 68, 0.15)';
    case 'RUNNING':
      return 'rgba(99, 102, 241, 0.2)';
    case 'READY':
      return 'rgba(245, 158, 11, 0.15)';
    case 'SKIPPED':
      return 'rgba(156, 163, 175, 0.15)';
    default:
      return 'rgba(255, 255, 255, 0.04)';
  }
}

function getStatusBorder(status: string) {
  switch (status) {
    case 'SUCCEEDED':
      return '#10b981';
    case 'FAILED':
      return '#ef4444';
    case 'RUNNING':
      return '#6366f1';
    case 'READY':
      return '#f59e0b';
    case 'SKIPPED':
      return '#9ca3af';
    default:
      return 'rgba(255, 255, 255, 0.1)';
  }
}

export function DagView({ steps, stepRuns = {} }: DagViewProps) {
  // Topological sorting levels computation
  const levels: Record<string, number> = {};
  const unresolved = new Set(steps.map((s) => s.id));

  let iterations = 0;
  while (unresolved.size > 0 && iterations < 100) {
    iterations++;
    let resolvedAny = false;
    for (const step of steps) {
      if (!unresolved.has(step.id)) continue;

      const deps = step.depends_on || [];
      const depsResolved = deps.every((dep) => dep in levels);

      if (depsResolved) {
        if (deps.length === 0) {
          levels[step.id] = 0;
        } else {
          levels[step.id] = Math.max(...deps.map((dep) => levels[dep])) + 1;
        }
        unresolved.delete(step.id);
        resolvedAny = true;
      }
    }

    if (!resolvedAny) {
      // Loop detected, place remaining nodes on the next level
      const maxLvl = Math.max(...Object.values(levels), -1) + 1;
      for (const id of unresolved) {
        levels[id] = maxLvl;
      }
      break;
    }
  }

  // Group steps by level to calculate vertical spacing
  const levelGroups: Record<number, string[]> = {};
  for (const step of steps) {
    const lvl = levels[step.id] ?? 0;
    if (!levelGroups[lvl]) levelGroups[lvl] = [];
    levelGroups[lvl].push(step.id);
  }

  const nodes = steps.map((step) => {
    const lvl = levels[step.id] ?? 0;
    const idx = levelGroups[lvl].indexOf(step.id);
    const numInLevel = levelGroups[lvl].length;

    // Center nodes in their level vertically
    const yOffset = (idx - (numInLevel - 1) / 2) * 100;
    const x = lvl * 280 + 80;
    const y = yOffset + 180;

    const status = stepRuns[step.id] || 'PENDING';

    return {
      id: step.id,
      data: {
        label: (
          <div style={{ textAlign: 'left', wordBreak: 'break-all' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{step.name || step.id}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--text-muted)' }}>
              <span>{step.type}</span>
              <span style={{
                color: status === 'SUCCEEDED' ? 'var(--success)' : status === 'FAILED' ? 'var(--danger)' : status === 'RUNNING' ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: 600
              }}>
                {status}
              </span>
            </div>
          </div>
        )
      },
      position: { x, y },
      type: 'default',
      style: {
        background: getStatusBg(status),
        color: 'var(--text)',
        border: `1px solid ${getStatusBorder(status)}`,
        borderRadius: '10px',
        padding: '12px 14px',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
        width: 200,
        backdropFilter: 'blur(8px)',
      },
    };
  });

  const edges = steps.flatMap((step) => {
    return (step.depends_on || []).map((dep) => {
      const isAnimated = stepRuns[dep] === 'RUNNING' || stepRuns[step.id] === 'RUNNING';
      const isCompleted = stepRuns[dep] === 'SUCCEEDED';
      return {
        id: `e-${dep}-${step.id}`,
        source: dep,
        target: step.id,
        animated: isAnimated,
        style: {
          stroke: isCompleted ? 'var(--success)' : isAnimated ? 'var(--accent)' : 'rgba(255, 255, 255, 0.12)',
          strokeWidth: 2.5,
        },
      };
    });
  });

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 400, background: 'rgba(0,0,0,0.15)', borderRadius: 12, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesConnectable={false}
        nodesDraggable={true}
        zoomOnScroll={false}
        preventScrolling={true}
      >
        <Background color="rgba(255,255,255,0.05)" gap={16} size={1} />
        <Controls showInteractive={false} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, overflow: 'hidden' }} />
      </ReactFlow>
    </div>
  );
}
