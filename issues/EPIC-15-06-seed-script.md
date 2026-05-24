# [Epic-15] Database seed script

**Labels**: `epic-15`, `good-first-issue`, `area-data`
**Estimate**: 1 jam
**Depends on**: #18, #19

## Context

Script untuk populate dev DB dengan tenant + user + workflow contoh.

## Acceptance Criteria

- [ ] `scripts/seed.ts` create:
  - Tenant `acme` slug
  - User `admin@acme.com` role ADMIN, password `password123`
  - 1 sample workflow dengan 3 step
- [ ] Idempotent (bisa dijalankan ulang tanpa error)
- [ ] Run dengan `pnpm seed`

## Implementation Hints

```ts
// scripts/seed.ts
import { createDbClient, loadConfig } from '@flowforge/shared';
import { hashPassword } from '@flowforge/auth';
import { createTenant, getTenantBySlug } from '../packages/api/src/repos/tenant.repo.js';
import { createUser, getUserByEmail } from '../packages/api/src/repos/user.repo.js';
import { createWorkflow } from '../packages/api/src/repos/workflow.repo.js';

async function seed() {
  const config = loadConfig();
  const db = createDbClient(config);

  let tenant = await getTenantBySlug(db, 'acme');
  if (!tenant) {
    tenant = await createTenant(db, { slug: 'acme', name: 'Acme Corp' });
    console.log('✓ Tenant created');
  }

  let user = await getUserByEmail(db, tenant.id, 'admin@acme.com');
  if (!user) {
    user = await createUser(db, {
      tenant_id: tenant.id,
      email: 'admin@acme.com',
      password_hash: await hashPassword('password123'),
      role: 'ADMIN',
    });
    console.log('✓ User created');
  }

  const wf = await createWorkflow(db, {
    tenant_id: tenant.id,
    name: 'Sample HTTP workflow',
    definition: {
      name: 'Sample',
      timeout_sec: 60,
      steps: [
        { id: 'fetch', type: 'HTTP', depends_on: [], config: { method: 'GET', url: 'https://httpbin.org/uuid' } },
        { id: 'wait', type: 'DELAY', depends_on: ['fetch'], config: { duration_ms: 1000 } },
      ],
    },
    created_by: user.id,
  });
  console.log('✓ Workflow created:', wf.id);

  await db.end();
  console.log('Seed complete. Login: tenant=acme email=admin@acme.com password=password123');
}

seed().catch((err) => { console.error(err); process.exit(1); });
```

Add to root package.json:

```json
{
  "scripts": {
    "seed": "tsx scripts/seed.ts"
  }
}
```

```bash
pnpm add -Dw tsx
```

## Files Involved

- `scripts/seed.ts`

## How to Verify

```bash
pnpm migrate:up
pnpm seed
# Login dengan credentials yang dikeluarkan
```
