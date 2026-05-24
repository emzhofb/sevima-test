export const up = (pgm) => {
  pgm.addColumns('workflows', {
    webhook_secret_hash: { type: 'text' },
  });
};

export const down = (pgm) => {
  pgm.dropColumns('workflows', ['webhook_secret_hash']);
};
