# [Epic-02] Workflow + WorkflowVersion repository (transactional create)

**Labels**: `epic-02`, `area-data`
**Estimate**: 2 jam
**Depends on**: #19 (user repo)

## Context

`createWorkflow` harus atomic: insert ke `workflows` + `workflow_versions` (version=1) dalam satu transaksi.

## Acceptance Criteria

- [ ] `createWorkflow` insert ke kedua tabel dalam satu transaksi
- [ ] `getWorkflowById(tenant_id, id)` returns workflow + current version
- [ ] `updateWorkflow(tenant_id, id, definition, userId)` create new version, advance current_version
- [ ] `listWorkflows(tenant_id, { page, pageSize, name?, status? })` dengan pagination
- [ ] `deleteWorkflow(tenant_id, id)` cascade
- [ ] Integration test untuk transactional behavior

## Implementation Hints

```ts
import type { Db } from '@flowforge/shared';
import { withTransaction } from '@flowforge/shared';
import type { WorkflowDefinition } from '@flowforge/shared';

export type Workflow = {
  id: string;
  tenant_id: string;
  name: string;
  current_version: number;
  created_at: Date;
  updated_at: Date;
};

export type WorkflowVersion = {
  id: string;
  workflow_id: string;
  version: number;
  definition: WorkflowDefinition;
  created_by: string | null;
  created_at: Date;
};

export type WorkflowWithVersion = Workflow & { version: WorkflowVersion };

export async function createWorkflow(
  db: Db,
  input: { tenant_id: string; name: string; definition: WorkflowDefinition; created_by: string },
): Promise<WorkflowWithVersion> {
  return withTransaction(db, async (client) => {
    const wfRes = await client.query<Workflow>(
      `INSERT INTO workflows (tenant_id, name, current_version)
       VALUES ($1, $2, 1) RETURNING *`,
      [input.tenant_id, input.name],
    );
    const wf = wfRes.rows[0];

    const versionRes = await client.query<WorkflowVersion>(
      `INSERT INTO workflow_versions (workflow_id, version, definition, created_by)
       VALUES ($1, 1, $2, $3) RETURNING *`,
      [wf.id, input.definition, input.created_by],
    );

    return { ...wf, version: versionRes.rows[0] };
  });
}

export async function getWorkflowById(
  db: Db,
  tenantId: string,
  id: string,
  version?: number,
): Promise<WorkflowWithVersion | null> {
  const wfRes = await db.query<Workflow>(
    'SELECT * FROM workflows WHERE tenant_id = $1 AND id = $2',
    [tenantId, id],
  );
  const wf = wfRes.rows[0];
  if (!wf) return null;

  const targetVersion = version ?? wf.current_version;
  const verRes = await db.query<WorkflowVersion>(
    'SELECT * FROM workflow_versions WHERE workflow_id = $1 AND version = $2',
    [id, targetVersion],
  );
  if (!verRes.rows[0]) return null;

  return { ...wf, version: verRes.rows[0] };
}

export async function updateWorkflow(
  db: Db,
  tenantId: string,
  id: string,
  definition: WorkflowDefinition,
  userId: string,
): Promise<WorkflowWithVersion | null> {
  return withTransaction(db, async (client) => {
    const wfRes = await client.query<Workflow>(
      `UPDATE workflows
       SET current_version = current_version + 1, updated_at = now()
       WHERE tenant_id = $1 AND id = $2
       RETURNING *`,
      [tenantId, id],
    );
    const wf = wfRes.rows[0];
    if (!wf) return null;

    const verRes = await client.query<WorkflowVersion>(
      `INSERT INTO workflow_versions (workflow_id, version, definition, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, wf.current_version, definition, userId],
    );

    return { ...wf, version: verRes.rows[0] };
  });
}

export async function listWorkflows(
  db: Db,
  tenantId: string,
  opts: { page?: number; pageSize?: number; name?: string } = {},
): Promise<{ items: Workflow[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = ['tenant_id = $1'];
  const params: unknown[] = [tenantId];
  if (opts.name) {
    params.push(`%${opts.name}%`);
    conditions.push(`name ILIKE $${params.length}`);
  }

  const where = conditions.join(' AND ');
  params.push(pageSize, offset);

  const itemsRes = await db.query<Workflow>(
    `SELECT * FROM workflows
     WHERE ${where}
     ORDER BY updated_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const totalRes = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM workflows WHERE ${where}`,
    params.slice(0, params.length - 2),
  );

  return {
    items: itemsRes.rows,
    total: Number(totalRes.rows[0].count),
  };
}
```

## Files Involved

- `packages/api/src/repos/workflow.repo.ts`
- `packages/api/src/repos/workflow.repo.test.ts`

## How to Verify

Test transactional rollback:

```ts
it('rolls back if version insert fails', async () => {
  // Force constraint violation by passing invalid data, verify no orphan workflow row
});
```

```bash
pnpm -F @flowforge/api test repos/workflow
```
