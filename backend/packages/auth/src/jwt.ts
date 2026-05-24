import jwt from 'jsonwebtoken';

import type { JwtClaims, Role } from './types.js';

export function signJwt(
  claims: { tenant_id: string; user_id: string; role: Role },
  secret: string,
  expiresInSec = 900,
): string {
  return jwt.sign(claims, secret, {
    algorithm: 'HS256',
    expiresIn: expiresInSec,
  });
}

export function verifyJwt(token: string, secret: string): JwtClaims | null {
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });

    if (typeof decoded === 'string') {
      return null;
    }

    return decoded as JwtClaims;
  } catch {
    return null;
  }
}
