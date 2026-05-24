import { startSchedulerService } from './index.js';

startSchedulerService().catch((err) => {
  console.error(err);
  process.exit(1);
});
