import argon2 from 'argon2';

const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
} as const;

export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, ARGON_OPTIONS);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}