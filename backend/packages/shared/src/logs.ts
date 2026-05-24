import type { Db } from './db.js';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export type LogEntry = {
  tenant_id: string;
  run_id: string;
  step_id: string;
  ts: Date;
  level: LogLevel;
  message: string;
  fields?: Record<string, unknown>;
};

export async function appendLogs(db: Db, entries: LogEntry[]): Promise<void> {
  if (entries.length === 0) return;

  const values: string[] = [];
  const params: unknown[] = [];

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    const idx = i * 7;
    values.push(
      `($${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7})`,
    );
    params.push(e.tenant_id, e.run_id, e.step_id, e.ts, e.level, e.message, e.fields ?? {});
  }

  await db.query(
    `INSERT INTO logs (tenant_id, run_id, step_id, ts, level, message, fields)
     VALUES ${values.join(',')}`,
    params,
  );
}
