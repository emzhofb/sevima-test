import { describe, it, expect, vi } from 'vitest';
import { startRun } from './start-run.js';
import { handleStepEvent } from './handle-step-event.js';

/**
 * E2E orchestrator test: simulates a linear DAG a → b → c
 * without requiring real DB or Redis. Uses mock implementations
 * to verify the full orchestration flow.
 */
describe('orchestrator E2E', () => {
  it('linear DAG a→b→c completes successfully', async () => {
    const DEFINITION = {
      steps: [
        { id: 'a', type: 'DELAY', depends_on: [], config: { duration_ms: 1 } },
        { id: 'b', type: 'DELAY', depends_on: ['a'], config: { duration_ms: 1 } },
        { id: 'c', type: 'DELAY', depends_on: ['b'], config: { duration_ms: 1 } },
      ],
    };

    // Simulated state
    let runStatus = 'PENDING';
    const stepRunsMap: Record<string, string> = {}; // stepId → status
    const enqueuedSteps: string[] = [];
    let processedEvents = new Set<string>();

    const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      // startRun queries
      if (sql.includes('SELECT * FROM runs WHERE id = $1 FOR UPDATE')) {
        return { rows: [{ id: 'run-1', tenant_id: 't1', version_id: 'v1', status: runStatus }] };
      }
      if (sql.includes('SELECT definition FROM workflow_versions WHERE id = $1')) {
        return { rows: [{ definition: DEFINITION }] };
      }
      if (sql.includes("UPDATE runs SET status = 'RUNNING'")) {
        runStatus = 'RUNNING';
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO step_runs') && sql.includes("'READY'")) {
        return { rows: [] };
      }

      // handleStepEvent queries
      if (sql.includes('INSERT INTO processed_events')) {
        const eventId = params?.[0] as string;
        if (processedEvents.has(eventId)) return { rows: [] };
        processedEvents.add(eventId);
        return { rows: [{ event_id: eventId }] };
      }
      if (sql.includes("UPDATE step_runs SET")) {
        const stepId = params?.[1] as string;
        const status = params?.[2] as string;
        if (stepId) {
          stepRunsMap[stepId] = status;
        }
        return { rows: [{ id: 'step-run-1', run_id: 'run-1', tenant_id: 't1', step_id: stepId, status }] };
      }
      if (sql.includes("UPDATE runs SET status = 'SUCCEEDED'")) {
        runStatus = 'SUCCEEDED';
        return { rows: [] };
      }
      if (sql.includes("UPDATE runs SET status = 'FAILED'")) {
        runStatus = 'FAILED';
        return { rows: [] };
      }
      if (sql.includes('SELECT step_id FROM step_runs') && sql.includes('status IN')) {
        return {
          rows: Object.entries(stepRunsMap)
            .filter(([, s]) => ['SUCCEEDED', 'SKIPPED', 'FAILED'].includes(s))
            .map(([id]) => ({ step_id: id })),
        };
      }
      if (sql.includes('SELECT status FROM step_runs WHERE run_id')) {
        const stepId = params?.[1] as string;
        const existing = stepRunsMap[stepId] || (sql.includes('FOR UPDATE') ? 'RUNNING' : undefined);
        return { rows: existing ? [{ status: existing }] : [] };
      }
      if (sql.includes('INSERT INTO step_runs')) {
        const stepId = params?.[2] as string;
        stepRunsMap[stepId] = 'READY';
        return { rows: [] };
      }

      return { rows: [] };
    });

    const mockDb = {
      query: clientQuery,
      connect: vi.fn(async () => ({ query: clientQuery, release: vi.fn() })),
    };

    const mockBroker = {
      enqueue: vi.fn(async (_stream: string, payload: any) => {
        enqueuedSteps.push(payload.step_id);
        return 'id';
      }),
      dequeue: vi.fn(),
      ack: vi.fn(),
      ensureGroup: vi.fn(),
    };

    // Step 1: orchestrator picks up run, enqueues root step 'a'
    await startRun(mockDb as any, mockBroker as any, 'run-1');
    expect(runStatus).toBe('RUNNING');
    expect(enqueuedSteps).toContain('a');

    // Step 2: simulate worker completing 'a'
    await handleStepEvent(mockDb as any, mockBroker as any, {
      event_id: 'evt-a',
      type: 'STEP_SUCCEEDED',
      run_id: 'run-1',
      step_id: 'a',
      attempt: 1,
    });
    expect(enqueuedSteps).toContain('b');

    // Step 3: simulate worker completing 'b'
    await handleStepEvent(mockDb as any, mockBroker as any, {
      event_id: 'evt-b',
      type: 'STEP_SUCCEEDED',
      run_id: 'run-1',
      step_id: 'b',
      attempt: 1,
    });
    expect(enqueuedSteps).toContain('c');

    // Step 4: simulate worker completing 'c'
    await handleStepEvent(mockDb as any, mockBroker as any, {
      event_id: 'evt-c',
      type: 'STEP_SUCCEEDED',
      run_id: 'run-1',
      step_id: 'c',
      attempt: 1,
    });

    // Verify run is SUCCEEDED
    expect(runStatus).toBe('SUCCEEDED');

    // Verify all steps completed in order
    expect(Object.keys(stepRunsMap).sort()).toEqual(['a', 'b', 'c']);
    expect(stepRunsMap['a']).toBe('SUCCEEDED');
    expect(stepRunsMap['b']).toBe('SUCCEEDED');
    expect(stepRunsMap['c']).toBe('SUCCEEDED');
  });

  it('run fails when a step fails without continue_on_failure', async () => {
    const DEFINITION = {
      steps: [
        { id: 'a', type: 'HTTP', depends_on: [], config: { url: 'http://fail', method: 'GET' } },
        { id: 'b', type: 'DELAY', depends_on: ['a'], config: { duration_ms: 1 } },
      ],
    };

    let runStatus = 'PENDING';
    const stepRunsMap: Record<string, string> = {};
    let processedEvents = new Set<string>();

    const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT * FROM runs WHERE id = $1 FOR UPDATE')) {
        return { rows: [{ id: 'run-1', tenant_id: 't1', version_id: 'v1', status: runStatus }] };
      }
      if (sql.includes('SELECT definition FROM workflow_versions WHERE id = $1')) {
        return { rows: [{ definition: DEFINITION }] };
      }
      if (sql.includes("UPDATE runs SET status = 'RUNNING'")) {
        runStatus = 'RUNNING';
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO processed_events')) {
        const eventId = params?.[0] as string;
        if (processedEvents.has(eventId)) return { rows: [] };
        processedEvents.add(eventId);
        return { rows: [{ event_id: eventId }] };
      }
      if (sql.includes('SELECT status FROM step_runs WHERE run_id')) {
        const stepId = params?.[1] as string;
        const existing = stepRunsMap[stepId] || (sql.includes('FOR UPDATE') ? 'RUNNING' : undefined);
        return { rows: existing ? [{ status: existing }] : [] };
      }
      if (sql.includes("UPDATE step_runs SET")) {
        const stepId = params?.[1] as string;
        const status = params?.[2] as string;
        if (stepId) {
          stepRunsMap[stepId] = status;
        }
        return { rows: [{ id: 'step-run-1', run_id: 'run-1', tenant_id: 't1', step_id: stepId, status }] };
      }
      if (sql.includes("UPDATE runs SET status = 'FAILED'")) {
        runStatus = 'FAILED';
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO step_runs')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const mockDb = {
      query: clientQuery,
      connect: vi.fn(async () => ({ query: clientQuery, release: vi.fn() })),
    };

    const mockBroker = {
      enqueue: vi.fn().mockResolvedValue('id'),
      dequeue: vi.fn(),
      ack: vi.fn(),
      ensureGroup: vi.fn(),
    };

    await startRun(mockDb as any, mockBroker as any, 'run-1');
    expect(runStatus).toBe('RUNNING');

    await handleStepEvent(mockDb as any, mockBroker as any, {
      event_id: 'evt-a-fail',
      type: 'STEP_FAILED',
      run_id: 'run-1',
      step_id: 'a',
      error: 'HTTP 500',
      attempt: 1,
    });

    expect(runStatus).toBe('FAILED');
    // 'b' should NOT have been enqueued
    const enqueuedAfterFail = (mockBroker.enqueue as any).mock.calls.filter(
      (c: any[]) => c[1]?.step_id === 'b',
    );
    expect(enqueuedAfterFail.length).toBe(0);
  });
});
