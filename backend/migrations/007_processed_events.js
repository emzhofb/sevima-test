export const up = (pgm) => {
  pgm.createTable('processed_events', {
    event_id: { type: 'varchar(100)', primaryKey: true },
    processed_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('processed_events', 'processed_at');
};

export const down = (pgm) => {
  pgm.dropTable('processed_events');
};