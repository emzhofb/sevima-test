# [Epic-13] POST /ai/generate-workflow endpoint

**Labels**: `epic-13`, `area-ai`, `stretch`
**Estimate**: 2.5 jam
**Depends on**: #99 (prompt), #100 (budget), #101 (PII)

## Context

Endpoint utama: terima prompt, redact PII, call LLM, validate output via parser, return DRAFT.

## Acceptance Criteria

- [ ] `POST /ai/generate-workflow` body: `{ prompt: string }`
- [ ] Return 404 jika `AI_ENABLED=false`
- [ ] Return 403 untuk role di bawah EDITOR
- [ ] Return 413 jika prompt > 4000 token (estimate by char count: 1 char ≈ 0.25 token, so > 16000 chars)
- [ ] Return 429 jika budget habis
- [ ] Call LLM with timeout 30s → 504 kalau timeout
- [ ] Validate output via parser
- [ ] Re-prompt 1x jika gagal validasi
- [ ] Return 422 jika tetap gagal setelah re-prompt
- [ ] Reject SCRIPT step types in output
- [ ] Return DRAFT (tidak persist ke DB)

## Implementation Hints

```ts
import OpenAI from 'openai';
import { parse } from '@flowforge/parser';
import { redactPII } from './pii.js';
import { buildPrompt } from './prompt.js';
import { checkTokenBudget, recordTokenUsage } from './budget.js';

const MAX_PROMPT_CHARS = 16000;

fastify.post(
  '/ai/generate-workflow',
  { preHandler: requireRole('EDITOR') },
  async (request, reply) => {
    if (!config.AI_ENABLED) {
      return reply.code(404).send({ error: 'not_found' });
    }

    const ctx = request.ctx!;
    const parsed = z.object({ prompt: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });

    if (parsed.data.prompt.length > MAX_PROMPT_CHARS) {
      return reply.code(413).send({ error: 'prompt_too_large' });
    }

    const budget = await checkTokenBudget(redis, ctx.tenant_id, 4000);
    if (!budget.allowed) {
      return reply.code(429).send({ error: 'budget_exceeded', remaining: budget.remaining });
    }

    const safePrompt = redactPII(parsed.data.prompt);
    const { system, user } = buildPrompt(safePrompt);

    const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

    const callLLM = async (messages: any[]) => {
      const completion = await Promise.race([
        openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages,
          response_format: { type: 'json_object' },
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 30000)),
      ]);
      return completion as any;
    };

    let candidate: string;
    try {
      const c1 = await callLLM([{ role: 'system', content: system }, { role: 'user', content: user }]);
      candidate = c1.choices[0].message.content;
      await recordTokenUsage(redis, ctx.tenant_id, c1.usage.total_tokens);
    } catch (err) {
      if ((err as Error).message === 'TIMEOUT') {
        return reply.code(504).send({ error: 'llm_timeout' });
      }
      throw err;
    }

    let parseResult = parse(candidate);

    // Re-prompt once if invalid
    if (!parseResult.ok) {
      const errMsg = JSON.stringify(parseResult.errors);
      try {
        const c2 = await callLLM([
          { role: 'system', content: system },
          { role: 'user', content: user },
          { role: 'assistant', content: candidate },
          { role: 'user', content: `The previous output failed validation: ${errMsg}. Fix and return ONLY corrected JSON.` },
        ]);
        candidate = c2.choices[0].message.content;
        await recordTokenUsage(redis, ctx.tenant_id, c2.usage.total_tokens);
        parseResult = parse(candidate);
      } catch (err) {
        if ((err as Error).message === 'TIMEOUT') {
          return reply.code(504).send({ error: 'llm_timeout' });
        }
        throw err;
      }
    }

    if (!parseResult.ok) {
      return reply.code(422).send({ error: 'invalid_generation', errors: parseResult.errors });
    }

    // Reject SCRIPT steps
    const hasScript = parseResult.definition.steps.some((s: any) => s.type === 'SCRIPT');
    if (hasScript) {
      return reply.code(422).send({
        error: 'script_step_rejected',
        message: 'Generated workflow contains SCRIPT step which is not allowed in AI generation.',
      });
    }

    return { draft: parseResult.definition };
  },
);
```

## Files Involved

- `packages/api/src/routes/ai.ts`
- Test (mock OpenAI)

## How to Verify

Test dengan stub LLM client.

```bash
pnpm -F @flowforge/api test ai
```
