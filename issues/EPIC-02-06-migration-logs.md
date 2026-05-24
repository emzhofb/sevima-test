# [Epic-02] Migration: logs table (simplified, PostgreSQL)

**Labels**: `epic-02`, `area-data`
**Estimate**: 1 jam
**Depends on**: #12

## Context

> Original spec menyebut ClickHouse + S3 Glacier. Untuk versi fresh grad, kita simplify ke PostgreSQL append-only table dengan partition by date. Cukup untuk MVP. Stretch goal: migrasi ke ClickHouse setelah core working.

## Acceptance Criteria

- [ ] Migration `005_logs.js`
- [ ] Tabel `logs` dengan partition by `ts` (RANGE per minggu)
- [ ] Kolom: `tenant_id`, `run_id`, `step_id`, `ts`, `level`, `message`, `fields (jsonb)`
- [ ] Index `(tenant_id, run_id, step_id, ts)`
- [ ] Buat 4 partition awal (current week + 3 minggu ke depan)

## Implementation Hints

```js
exports.up = (pgm) => {
  // Parent table
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

  // Buat partition per minggu untuk 4 minggu ke depan
  // Helper untuk dihitung saat apply migration
  const weeks = 4;
  for (let i = 0; i < weeks; i++) {
    pgm.sql(`
      CREATE TABLE logs_week_${i} PARTITION OF logs
      FOR VALUES FROM (date_trunc('week', now() + interval '${i} week'))
                  TO   (date_trunc('week', now() + interval '${i + 1} week'));
    `);
  }
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS logs CASCADE;');
};
```

## Notes

- Untuk production: bikin job mingguan yang membuat partition baru otomatis. Untuk MVP fresh grad, manual cukup.
- Tidak ada update/delete dari aplikasi (append-only enforced di repository layer, lihat issue Epic 02 nanti).

## Files Involved

- `migrations/005_logs.js`

## How to Verify

```bash
pnpm migrate:up
psql $DATABASE_URL -c "\d+ logs"
psql $DATABASE_URL -c "SELECT relname FROM pg_class WHERE relname LIKE 'logs%';"
```
