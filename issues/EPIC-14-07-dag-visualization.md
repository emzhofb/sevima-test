# [Epic-14] DAG visualization (simple)

**Labels**: `epic-14`, `area-frontend`, `stretch`
**Estimate**: 3 jam
**Depends on**: #105

## Context

Visualisasi DAG sederhana. Pakai `react-flow` atau plain SVG.

## Acceptance Criteria

- [ ] Component `<DagView definition={...} stepStatuses={...} />`
- [ ] Render setiap step sebagai node, edge sesuai `depends_on`
- [ ] Color step by status (pending=gray, running=blue, succeeded=green, failed=red)
- [ ] Auto-layout (top-down)

## Implementation Hints

```bash
pnpm -F @flowforge/web add reactflow
```

```tsx
// src/components/DagView.tsx
import ReactFlow, { Node, Edge, Background } from 'reactflow';
import 'reactflow/dist/style.css';

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#cbd5e1',
  READY: '#cbd5e1',
  RUNNING: '#3b82f6',
  SUCCEEDED: '#10b981',
  FAILED: '#ef4444',
  SKIPPED: '#94a3b8',
};

export function DagView({ definition, statuses }: {
  definition: any;
  statuses: Record<string, string>;
}) {
  // Simple level-based layout
  const levels = computeLevels(definition);
  const nodes: Node[] = definition.steps.map((s: any) => {
    const level = levels[s.id];
    const idx = levels[`__${level}_idx`]++ as any;
    return {
      id: s.id,
      data: { label: `${s.id}\n(${s.type})` },
      position: { x: idx * 200, y: level * 100 },
      style: {
        background: STATUS_COLORS[statuses[s.id] ?? 'PENDING'],
        color: 'white',
        padding: 10,
      },
    };
  });

  const edges: Edge[] = [];
  for (const step of definition.steps) {
    for (const dep of step.depends_on) {
      edges.push({ id: `${dep}-${step.id}`, source: dep, target: step.id });
    }
  }

  return (
    <div style={{ width: '100%', height: 500 }}>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
      </ReactFlow>
    </div>
  );
}

function computeLevels(def: any): Record<string, number> {
  const levels: Record<string, number> = {};
  const visited = new Set<string>();

  function visit(id: string): number {
    if (levels[id] !== undefined) return levels[id];
    const step = def.steps.find((s: any) => s.id === id);
    if (!step) return 0;
    if (step.depends_on.length === 0) return (levels[id] = 0);
    const max = Math.max(...step.depends_on.map(visit));
    return (levels[id] = max + 1);
  }

  for (const s of def.steps) visit(s.id);
  return levels;
}
```

## Files Involved

- `packages/web/src/components/DagView.tsx`

## How to Verify

```bash
pnpm -F @flowforge/web dev
# Buka run detail page yang punya DAG
```
