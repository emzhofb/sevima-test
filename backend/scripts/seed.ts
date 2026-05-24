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
    console.log('✓ Tenant acme created');
  } else {
    console.log('✓ Tenant acme already exists');
  }

  let user = await getUserByEmail(db, tenant.id, 'admin@acme.com');
  if (!user) {
    user = await createUser(db, {
      tenant_id: tenant.id,
      email: 'admin@acme.com',
      password_hash: await hashPassword('password123'),
      role: 'ADMIN',
    });
    console.log('✓ User admin@acme.com created');
  } else {
    console.log('✓ User admin@acme.com already exists');
  }

  const definition = {
    name: 'Sample',
    timeout_sec: 60,
    steps: [
      { id: 'fetch', type: 'HTTP', depends_on: [], config: { method: 'GET', url: 'https://httpbin.org/uuid' } },
      { id: 'wait', type: 'DELAY', depends_on: ['fetch'], config: { duration_ms: 1000 } },
    ],
  };

  const wf = await createWorkflow(db, {
    tenant_id: tenant.id,
    name: 'Sample HTTP workflow',
    definition,
    created_by: user.id,
  });
  console.log('✓ Workflow created:', wf.id);

  await db.end();
  console.log('Seed complete. Login: tenant=acme email=admin@acme.com password=password123');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
