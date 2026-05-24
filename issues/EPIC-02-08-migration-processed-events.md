# [Epic-02] Migration: processed_events for idempotency

**Labels**: `epic-02`, `area-data`
**Estimate**: 0.5 jam
**Depends on**: #12

## Context

Untuk dedup event yang sama (idempotency Property 9). Setiap event handler insert ke tabel ini; insert kedua akan ditolak unique constraint.

## Acceptance Criteria

- [ ] Migration `007_processed_events.js`
- [ ] Tabel `processed_events`: `event_id`, `processed_at`
- [ ] PK pada `event_id`
- [ ] TTL cleanup script (optional, manual delete > 7 hari)

## Implementation Hints

```js
exports.up = (pgm) => {
  pgm.createTable('processed_events', {
    event_id: { type: 'varchar(100)', primaryKey: true },
    processed_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('processed_events', 'processed_at');
};

exports.down = (pgm) => {
  pgm.dropTable('processed_events');
};
```

## Files Involved

- `migrations/007_processed_events.js`

## How to Verify

```bash
pnpm migrate:up
psql $DATABASE_URL -c "\d processed_events"
```
