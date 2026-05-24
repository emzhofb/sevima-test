import type { WorkflowDefinition } from '@flowforge/shared';

export function computeReadySet(
  definition: WorkflowDefinition,
  completed: Set<string>,
): Set<string> {
  const ready = new Set<string>();
  for (const step of definition.steps) {
    if (completed.has(step.id)) continue;
    const allDepsCompleted = step.depends_on.every((dep: string) => completed.has(dep));
    if (allDepsCompleted) ready.add(step.id);
  }
  return ready;
}
