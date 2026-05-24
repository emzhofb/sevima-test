# [Epic-13] AI Gateway package setup

**Labels**: `epic-13`, `good-first-issue`, `area-ai`, `stretch`
**Estimate**: 0.5 jam
**Depends on**: #38

## Context

Package untuk integrasi LLM provider. Feature flag `AI_ENABLED`.

## Acceptance Criteria

- [ ] `packages/ai-gateway/package.json`
- [ ] Config check `AI_ENABLED`
- [ ] OpenAI SDK installed (atau Anthropic, pilih satu)

## Implementation Hints

```bash
pnpm add -F @flowforge/ai-gateway openai @flowforge/shared @flowforge/parser
```

Update config schema:

```ts
const ConfigSchema = z.object({
  // ... existing
  AI_ENABLED: z.coerce.boolean().default(false),
  OPENAI_API_KEY: z.string().optional(),
});
```

```ts
// packages/ai-gateway/src/index.ts
export { generateWorkflowFromNL } from './generate.js';
export { isAiEnabled } from './config.js';
```

## Files Involved

- `packages/ai-gateway/package.json`
- `packages/ai-gateway/src/index.ts`
- Update shared config

## How to Verify

```bash
pnpm -F @flowforge/ai-gateway typecheck
```
