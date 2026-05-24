/* eslint-disable custom-security/reject-sql-without-tenant */
import { createDbClient, loadConfig, createLogger } from '@flowforge/shared';

async function cleanup() {
  const log = createLogger('cleanup');
  const config = loadConfig();
  const db = createDbClient(config);

  log.info('Running execution logs cleanup...');
  const result = await db.query(
    `DELETE FROM logs WHERE ts < now() - interval '30 days'`
  );
  log.info({ deleted: result.rowCount }, 'Cleaned up old logs');

  await db.end();
}

cleanup().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
