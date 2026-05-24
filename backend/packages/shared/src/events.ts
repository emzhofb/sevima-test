import type { Redis } from 'ioredis';

export type RealtimeEvent = {
  tenant_id: string;
  run_id: string;
  type:
    | 'RUN_QUEUED'
    | 'RUN_STARTED'
    | 'STEP_STARTED'
    | 'STEP_SUCCEEDED'
    | 'STEP_FAILED'
    | 'RUN_SUCCEEDED'
    | 'RUN_FAILED'
    | 'RUN_TIMED_OUT'
    | 'RUN_CANCELLED';
  step_id?: string;
  ts: number;
  payload?: unknown;
};

export async function publishEvent(redis: Redis, event: RealtimeEvent): Promise<void> {
  await redis.publish('flowforge:events', JSON.stringify(event));
}
