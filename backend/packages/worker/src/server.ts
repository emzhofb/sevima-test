import { startWorker } from './index.js';

startWorker().catch((err) => {
  console.error(err);
  process.exit(1);
});
