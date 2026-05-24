export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE logs (
      tenant_id uuid NOT NULL,
      run_id uuid NOT NULL,
      step_id varchar(100) NOT NULL,
      ts timestamptz NOT NULL DEFAULT now(),
      level varchar(10) NOT NULL CHECK (level IN ('DEBUG','INFO','WARN','ERROR')),
      message text NOT NULL,
      fields jsonb NOT NULL DEFAULT '{}'
    ) PARTITION BY RANGE (ts);
  `);

  pgm.sql(`
    CREATE INDEX idx_logs_run_step_ts
    ON logs (tenant_id, run_id, step_id, ts);
  `);

  const weeks = 4;

  for (let i = 0; i < weeks; i += 1) {
    pgm.sql(`
      CREATE TABLE logs_week_${i} PARTITION OF logs
      FOR VALUES FROM (date_trunc('week', now() + interval '${i} week'))
                  TO (date_trunc('week', now() + interval '${i + 1} week'));
    `);
  }
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS logs CASCADE;');
};
