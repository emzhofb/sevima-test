import type { WorkflowDefinition } from '@flowforge/shared';

export function detectCycles(definition: WorkflowDefinition): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const step of definition.steps) {
    for (const dep of step.depends_on) {
      if (!adjacency.has(dep)) adjacency.set(dep, []);
      adjacency.get(dep)!.push(step.id);
    }
    if (!adjacency.has(step.id)) adjacency.set(step.id, []);
  }

  const cycles: string[][] = [];
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  for (const id of adjacency.keys()) color.set(id, WHITE);

  function dfs(node: string, path: string[]): void {
    color.set(node, GRAY);
    path.push(node);

    for (const next of adjacency.get(node) ?? []) {
      const c = color.get(next);
      if (c === GRAY) {
        const cycleStart = path.indexOf(next);
        if (cycleStart >= 0) {
          cycles.push(path.slice(cycleStart).concat(next));
        }
      } else if (c === WHITE) {
        dfs(next, path);
      }
    }

    color.set(node, BLACK);
    path.pop();
  }

  for (const id of adjacency.keys()) {
    if (color.get(id) === WHITE) {
      dfs(id, []);
    }
  }

  return cycles;
}
