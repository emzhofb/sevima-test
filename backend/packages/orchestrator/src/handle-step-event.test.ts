import { describe, it, expect, vi } from 'vitest';
import { handleStepEvent } from './handle-step-event.js';

const WORKFLOW_DEF = {
  steps: [
    { id: 'a', type: 'DELAY', depends_on: [], config: { duration_ms: 100 } },
    { id: 'b', type: 'DELAY', depends_on: ['a'], config: { duration_ms: 100 } },
    { id: 'c', type: 'DELAY', depends_on: ['b'], config: { duration_ms: 100 } },
  ],
};

function makeMocks(runStatus: string = 'RUNNING', initialCompleted: string[] = []) {
  const processedEvents = new Set<string>();
  let currentRunStatus = runStatus;
  // Track step statuses in a mutable map so updates are visible
  const stepStatuses: Record<string, string> = {};
  for (const id of initialCompleted) {
    stepStatuses[id] = 'SUCCEEDED';
  }
  const enqueuedSteps: any[] = [];

  const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
    if (sql.includes('INSERT INTO processed_events')) {
      const eventId = params?.[0] as string;
      if (processedEvents.has(eventId)) {
        return { rows: [] }; // Already processed
      }
      processedEvents.add(eventId);
      return { rows: [{ event_id: eventId }] };
    }

    if (sql.includes('SELECT * FROM runs WHERE id = $1 FOR UPDATE')) {
      return {
        rows: [
          {
            id: params?.[0],
            tenant_id: 'tenant-1',
            version_id: 'version-1',
            status: currentRunStatus,
          },
        ],
      };
    }

    if (sql.includes('SELECT definition')) {
      return { rows: [{ definition: WORKFLOW_DEF }] };
    }

    if (sql.includes("UPDATE step_runs SET status = 'SUCCEEDED'")) {
      const stepId = params?.[2] as string;
      stepStatuses[stepId] = 'SUCCEEDED';
      return { rows: [] };
    }

    if (sql.includes("UPDATE step_runs SET status = 'FAILED'")) {
      const stepId = params?.[2] as string;
      stepStatuses[stepId] = 'FAILED';
      return { rows: [] };
    }

    if (sql.includes("UPDATE runs SET status = 'FAILED'")) {
      currentRunStatus = 'FAILED';
      return { rows: [] };
    }

    if (sql.includes("UPDATE runs SET status = 'SUCCEEDED'")) {
      currentRunStatus = 'SUCCEEDED';
      return { rows: [] };
    }

    // Completed steps query for computing ready set
    if (sql.includes('SELECT step_id FROM step_runs') && sql.includes('status IN')) {
      return {
        rows: Object.entries(stepStatuses)
          .filter(([, s]) => ['SUCCEEDED', 'SKIPPED', 'FAILED'].includes(s))
          .map(([id]) => ({ step_id: id })),
      };
    }

    // Check if a step_run already exists (to avoid duplicate enqueue)
    if (sql.includes('SELECT status FROM step_runs WHERE run_id')) {
      const stepId = params?.[1] as string;
      const status = stepStatuses[stepId];
      return { rows: status ? [{ status }] : [] };
    }

    if (sql.includes('INSERT INTO step_runs')) {
      const stepId = params?.[2] as string;
      stepStatuses[stepId] = 'READY';
      return { rows: [] };
    }

    return { rows: [] };
  });

  const mockDb = {
    query: clientQuery,
    connect: vi.fn(async () => ({
      query: clientQuery,
      release: vi.fn(),
    })),
  };

  const mockBroker = {
    enqueue: vi.fn(async (_stream: string, payload: any) => {
      enqueuedSteps.push(payload);
      return 'id';
    }),
    dequeue: vi.fn(),
    ack: vi.fn(),
    ensureGroup: vi.fn(),
  };

  return { mockDb, mockBroker, enqueuedSteps, getRunStatus: () => currentRunStatus };
}

describe('handleStepEvent', () => {
  it('enqueues next step when step a succeeds in a→b→c DAG', async () => {
    const { mockDb, mockBroker, enqueuedSteps } = makeMocks('RUNNING', []);

    await handleStepEvent(mockDb as any, mockBroker as any, {
      event_id: 'evt-a',
      type: 'STEP_SUCCEEDED',
      run_id: 'run-1',
      step_id: 'a',
      attempt: 1,
    });

    // After 'a' succeeds, 'b' should be ready (depends_on: ['a'])
    expect(enqueuedSteps.length).toBe(1);
    expect(enqueuedSteps[0]?.step_id).toBe('b');
  });

  it('marks run SUCCEEDED when all steps complete', async () => {
    // 'a' and 'b' are already completed, 'c' is the last step
    const { mockDb, mockBroker, getRunStatus } = makeMocks('RUNNING', ['a', 'b']);

    await handleStepEvent(mockDb as any, mockBroker as any, {
      event_id: 'evt-c',
      type: 'STEP_SUCCEEDED',
      run_id: 'run-1',
      step_id: 'c',
      attempt: 1,
    });

    expect(getRunStatus()).toBe('SUCCEEDED');
  });

  it('marks run FAILED when step fails without continue_on_failure', async () => {
    const { mockDb, mockBroker, getRunStatus } = makeMocks('RUNNING', []);

    await handleStepEvent(mockDb as any, mockBroker as any, {
      event_id: 'evt-a-fail',
      type: 'STEP_FAILED',
      run_id: 'run-1',
      step_id: 'a',
      error: 'network error',
      attempt: 1,
    });

    expect(getRunStatus()).toBe('FAILED');
  });

  it('is idempotent: duplicate event_id is ignored', async () => {
    const { mockDb, mockBroker, enqueuedSteps } = makeMocks('RUNNING', []);

    await handleStepEvent(mockDb as any, mockBroker as any, {
      event_id: 'evt-dup',
      type: 'STEP_SUCCEEDED',
      run_id: 'run-1',
      step_id: 'a',
      attempt: 1,
    });

    const firstEnqueued = enqueuedSteps.length;

    await handleStepEvent(mockDb as any, mockBroker as any, {
      event_id: 'evt-dup', // same event_id
      type: 'STEP_SUCCEEDED',
      run_id: 'run-1',
      step_id: 'a',
      attempt: 1,
    });

    // Second call should not enqueue more
    expect(enqueuedSteps.length).toBe(firstEnqueued);
  });

  it('ignores event for CANCELLED run', async () => {
    const { mockDb, mockBroker, enqueuedSteps, getRunStatus } = makeMocks('CANCELLED', []);

    await handleStepEvent(mockDb as any, mockBroker as any, {
      event_id: 'evt-after-cancel',
      type: 'STEP_SUCCEEDED',
      run_id: 'run-1',
      step_id: 'a',
      attempt: 1,
    });

    // Should not enqueue or change status
    expect(enqueuedSteps.length).toBe(0);
    expect(getRunStatus()).toBe('CANCELLED');
  });

  it('ignores event for TIMED_OUT run', async () => {
    const { mockDb, mockBroker, enqueuedSteps } = makeMocks('TIMED_OUT', []);

    await handleStepEvent(mockDb as any, mockBroker as any, {
      event_id: 'evt-timeout',
      type: 'STEP_SUCCEEDED',
      run_id: 'run-1',
      step_id: 'a',
      attempt: 1,
    });

    expect(enqueuedSteps.length).toBe(0);
  });
});
