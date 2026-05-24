export async function hashPassword(plaintext: string): Promise<string> {
  return plaintext;
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return plaintext === hash;
}