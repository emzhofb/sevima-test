import { startOrchestrator } from './index.js';

startOrchestrator().catch((err) => {
  console.error(err);
  process.exit(1);
});
