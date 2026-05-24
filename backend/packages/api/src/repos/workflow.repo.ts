import type { Db, Workflow, WorkflowDefinition, WorkflowVersion } from '@flowforge/shared';
import { withTransaction } from '@flowforge/shared';

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

    const workflow = wfRes.rows[0];

    const versionRes = await client.query<WorkflowVersion>(
      `INSERT INTO workflow_versions (workflow_id, version, definition, created_by)
       VALUES ($1, 1, $2, $3) RETURNING *`,
      [workflow.id, input.definition, input.created_by],
    );

    return { ...workflow, version: versionRes.rows[0] };
  });
}

export async function getWorkflowById(
  db: Db,
  tenantId: string,
  id: string,
  version?: number,
): Promise<WorkflowWithVersion | null> {
  const wfRes = await db.query<Workflow>('SELECT * FROM workflows WHERE tenant_id = $1 AND id = $2', [tenantId, id]);
  const workflow = wfRes.rows[0];

  if (!workflow) {
    return null;
  }

  const targetVersion = version ?? workflow.current_version;
  const verRes = await db.query<WorkflowVersion>('SELECT * FROM workflow_versions WHERE workflow_id = $1 AND version = $2', [id, targetVersion]);

  if (!verRes.rows[0]) {
    return null;
  }

  return { ...workflow, version: verRes.rows[0] };
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

    const workflow = wfRes.rows[0];
    if (!workflow) {
      return null;
    }

    const versionRes = await client.query<WorkflowVersion>(
      `INSERT INTO workflow_versions (workflow_id, version, definition, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, workflow.current_version, definition, userId],
    );

    return { ...workflow, version: versionRes.rows[0] };
  });
}

export async function listWorkflows(
  db: Db,
  tenantId: string,
  opts: { page?: number; pageSize?: number; name?: string; status?: string } = {},
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

  const totalRes = await db.query<{ count: string }>(`SELECT COUNT(*)::text as count FROM workflows WHERE ${where}`, params.slice(0, params.length - 2));

  return {
    items: itemsRes.rows,
    total: Number(totalRes.rows[0].count),
  };
}

export async function deleteWorkflow(db: Db, tenantId: string, id: string): Promise<void> {
  await db.query('DELETE FROM workflows WHERE tenant_id = $1 AND id = $2', [tenantId, id]);
}

export async function rollbackWorkflow(
  db: Db,
  tenantId: string,
  workflowId: string,
  targetVersion: number,
  userId: string,
): Promise<WorkflowWithVersion> {
  return withTransaction(db, async (client) => {
    const wfRes = await client.query<Workflow>(
      'SELECT * FROM workflows WHERE tenant_id = $1 AND id = $2 FOR UPDATE',
      [tenantId, workflowId],
    );
    const workflow = wfRes.rows[0];

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const targetRes = await client.query<WorkflowVersion>(
      'SELECT * FROM workflow_versions WHERE workflow_id = $1 AND version = $2',
      [workflowId, targetVersion],
    );
    const target = targetRes.rows[0];

    if (!target) {
      throw new Error(`Version ${targetVersion} not found`);
    }

    const updatedRes = await client.query<Workflow>(
      `UPDATE workflows
       SET current_version = current_version + 1, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [workflowId],
    );

    const updatedWorkflow = updatedRes.rows[0];

    const versionRes = await client.query<WorkflowVersion>(
      `INSERT INTO workflow_versions (workflow_id, version, definition, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [workflowId, updatedWorkflow.current_version, target.definition, userId],
    );

    return { ...updatedWorkflow, version: versionRes.rows[0] };
  });
}