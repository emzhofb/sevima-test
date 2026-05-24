import { describe, expect, it } from 'vitest';

import { signJwt, verifyJwt } from './jwt.js';

const SECRET = 'test-secret-at-least-32-chars-long-12345';

describe('jwt', () => {
  it('signs and verifies round-trip', () => {
    const token = signJwt({ tenant_id: 't1', user_id: 'u1', role: 'EDITOR' }, SECRET);
    const claims = verifyJwt(token, SECRET);

    expect(claims).not.toBeNull();
    expect(claims!.tenant_id).toBe('t1');
    expect(claims!.user_id).toBe('u1');
    expect(claims!.role).toBe('EDITOR');
  });

  it('returns null on invalid signature', () => {
    const token = signJwt({ tenant_id: 't1', user_id: 'u1', role: 'EDITOR' }, SECRET);

    expect(verifyJwt(token, 'wrong-secret-at-least-32-chars-long-x')).toBeNull();
  });

  it('returns null on expired token', () => {
    const token = signJwt({ tenant_id: 't1', user_id: 'u1', role: 'EDITOR' }, SECRET, -1);

    expect(verifyJwt(token, SECRET)).toBeNull();
  });
});
