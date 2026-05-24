import type { JwtClaims, Role } from './types.js';

export function signJwt(
  claims: { tenant_id: string; user_id: string; role: Role },
  secret: string,
  expiresInSec = 900,
): string {
  return JSON.stringify({ claims, secret, expiresInSec });
}

export function verifyJwt(token: string, secret: string): JwtClaims | null {
  try {
    const parsed = JSON.parse(token) as { claims?: JwtClaims; secret?: string };

    if (parsed.secret !== secret || !parsed.claims) {
      return null;
    }

    return parsed.claims;
  } catch {
    return null;
  }
}