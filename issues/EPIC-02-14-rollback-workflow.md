# [Epic-02] rollbackWorkflow function

**Labels**: `epic-02`, `area-data`
**Estimate**: 1 jam
**Depends on**: #20 (workflow repo)

## Context

Rollback berarti: bikin versi baru dengan content dari versi target, advance current_version. Tidak ngubah versi lama.

## Acceptance Criteria

- [ ] Function `rollbackWorkflow(db, tenantId, workflowId, targetVersion, userId)` ada
- [ ] Throw error kalau target version tidak ada
- [ ] Throw error kalau workflow tidak ada (atau bukan milik tenant)
- [ ] Run yang sedang RUNNING tidak terpengaruh (mereka pakai version_id snapshot)
- [ ] Test integration

## Implementation Hints

Tambahkan ke `workflow.repo.ts`:

```ts
export async function rollbackWorkflow(
  db: Db,
  tenantId: string,
  workflowId: string,
  targetVersion: number,
  userId: string,
): Promise<WorkflowWithVersion> {
  return withTransaction(db, async (client) => {
    // Fetch + lock workflow
    const wfRes = await client.query<Workflow>(
      'SELECT * FROM workflows WHERE tenant_id = $1 AND id = $2 FOR UPDATE',
      [tenantId, workflowId],
    );
    const wf = wfRes.rows[0];
    if (!wf) {
      throw new Error('Workflow not found');
    }

    // Fetch target version
    const targetRes = await client.query<WorkflowVersion>(
      'SELECT * FROM workflow_versions WHERE workflow_id = $1 AND version = $2',
      [workflowId, targetVersion],
    );
    const target = targetRes.rows[0];
    if (!target) {
      throw new Error(`Version ${targetVersion} not found`);
    }

    // Bump current_version
    const updatedWfRes = await client.query<Workflow>(
      `UPDATE workflows
       SET current_version = current_version + 1, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [workflowId],
    );
    const updatedWf = updatedWfRes.rows[0];

    // Insert new version with old definition
    const newVersionRes = await client.query<WorkflowVersion>(
      `INSERT INTO workflow_versions (workflow_id, version, definition, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [workflowId, updatedWf.current_version, target.definition, userId],
    );

    return { ...updatedWf, version: newVersionRes.rows[0] };
  });
}
```

Test:

```ts
it('rollback creates new version with old definition', async () => {
  const wf = await createWorkflow(db, { tenant_id, name: 'Test', definition: defV1, created_by: userId });
  await updateWorkflow(db, tenant_id, wf.id, defV2, userId);
  const rolled = await rollbackWorkflow(db, tenant_id, wf.id, 1, userId);

  expect(rolled.current_version).toBe(3);
  expect(rolled.version.definition).toEqual(defV1);
});

it('throws on missing target version', async () => {
  const wf = await createWorkflow(db, { tenant_id, name: 'Test', definition: defV1, created_by: userId });
  await expect(
    rollbackWorkflow(db, tenant_id, wf.id, 99, userId),
  ).rejects.toThrow('Version 99 not found');
});
```

## Files Involved

- `packages/api/src/repos/workflow.repo.ts`
- `packages/api/src/repos/workflow.repo.test.ts`

## How to Verify

```bash
pnpm -F @flowforge/api test repos/workflow
```
