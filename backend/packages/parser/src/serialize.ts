import { stringify as stringifyYaml } from 'yaml';
import type { WorkflowDefinition } from '@flowforge/shared';

function sortObjectKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  if (obj && typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
}

export function prettyPrint(definition: WorkflowDefinition): string {
  const canonical = sortObjectKeys(definition);
  // Ensure line endings are LF (\n)
  const jsonStr = JSON.stringify(canonical, null, 2);
  return jsonStr.replace(/\r\n/g, '\n') + '\n';
}

export function serialize(
  definition: WorkflowDefinition,
  format: 'json' | 'yaml' = 'json',
): string {
  const sorted = sortObjectKeys(definition);
  if (format === 'yaml') {
    const yamlStr = stringifyYaml(sorted, { indent: 2, lineWidth: 0 });
    return yamlStr.replace(/\r\n/g, '\n');
  }
  return prettyPrint(definition);
}
