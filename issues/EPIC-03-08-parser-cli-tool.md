# [Epic-03] CLI tool: validate workflow file

**Labels**: `epic-03`, `good-first-issue`, `area-parser`, `stretch`
**Estimate**: 1 jam
**Depends on**: #27, #28

## Context

CLI sederhana untuk developer: `pnpm flowforge validate path/to/workflow.json` → cetak hasil validasi.

## Acceptance Criteria

- [ ] Script `packages/parser/src/cli.ts` membaca file path dari argv
- [ ] Output success / list error dengan exit code 0 atau 1
- [ ] Bisa di-call via `node packages/parser/dist/cli.js`

## Implementation Hints

```ts
// packages/parser/src/cli.ts
import { readFileSync } from 'fs';
import { parse } from './parser.js';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: flowforge-validate <path>');
  process.exit(2);
}

const content = readFileSync(filePath, 'utf-8');
const result = parse(content);

if (result.ok) {
  console.log('✓ Valid workflow');
  console.log('Topological order:', result.sorted.join(' → '));
  process.exit(0);
} else {
  console.error('✗ Invalid workflow:');
  for (const err of result.errors) {
    console.error(`  - [${err.issue}] ${err.step_id ?? '<root>'}: ${err.message}`);
  }
  process.exit(1);
}
```

`packages/parser/package.json` tambahkan:

```json
{
  "bin": {
    "flowforge-validate": "dist/cli.js"
  }
}
```

## Files Involved

- `packages/parser/src/cli.ts`
- Update `packages/parser/package.json`

## How to Verify

```bash
pnpm -F @flowforge/parser build
echo '{"name":"x","timeout_sec":60,"steps":[]}' > /tmp/wf.json
node packages/parser/dist/cli.js /tmp/wf.json
# Atau via npx
```
