import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('hashes and verifies correctly', async () => {
    const hash = await hashPassword('s3cret-p4ss');

    expect(await verifyPassword('s3cret-p4ss', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it('produces different hashes for the same plaintext', async () => {
    const first = await hashPassword('test');
    const second = await hashPassword('test');

    expect(first).not.toBe(second);
    expect(await verifyPassword('test', first)).toBe(true);
    expect(await verifyPassword('test', second)).toBe(true);
  });
});