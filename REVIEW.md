# REVIEW.md — Code Review Exercise

Review dari `featureX.ts` yang akan di-merge.

## Original code

```ts
async function getWorkflowsForUser(userId: string) {
  const result = await db.query(
    `SELECT * FROM workflows WHERE created_by = '${userId}'`
  );
  return result.rows;
}
```

## Review comments

### 🔴 [Security] SQL Injection vulnerability

The `userId` is interpolated directly into the SQL string. Any user-controlled value here opens the door to injection attacks. Use parameterized queries instead:

```ts
const result = await db.query(
  'SELECT * FROM workflows WHERE created_by = $1',
  [userId],
);
```

### 🔴 [Security] Missing tenant scoping

This query returns workflows across all tenants. In a multi-tenant system, every query touching tenant data must include `tenant_id` predicate. Suggest:

```ts
const result = await db.query(
  'SELECT * FROM workflows WHERE tenant_id = $1 AND created_by = $2',
  [tenantId, userId],
);
```

### 🟡 [Performance] SELECT *

Avoid `SELECT *` in production. List only the columns you actually use; this also makes the query stable across schema changes.

### 🟡 [Style] Function naming

`getWorkflowsForUser` doesn't tell the caller about the tenant scoping or whether it returns latest versions. Consider `listWorkflowsCreatedByUser(tenantId, userId)`.

### 🟢 [Nit] Add return type annotation

```ts
async function listWorkflowsCreatedByUser(
  tenantId: string, userId: string
): Promise<Workflow[]> { ... }
```

Helps IDE auto-complete and catches return-shape regressions early.

---

Overall the change is small but two issues are blocking (SQL injection, missing tenant scoping). The performance and naming notes are non-blocking but worth addressing in a follow-up.

LGTM after the two security fixes. Thanks for the PR! 🙏
