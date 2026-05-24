import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { hashPassword, verifyPassword } from '@flowforge/auth';
import type { Db } from '@flowforge/shared';

/**
 * Generate a new webhook secret, store its hash in DB, and return the plaintext.
 * The plaintext is shown only once — callers must present it to users immediately.
 */
export async function rotateWebhookSecret(
  db: Db,
  tenantId: string,
  workflowId: string,
): Promise<string> {
  const plain = randomBytes(32).toString('hex');
  const hash = await hashPassword(plain);

  await db.query(
    'UPDATE workflows SET webhook_secret_hash = $1, webhook_secret = $2 WHERE tenant_id = $3 AND id = $4',
    [hash, plain, tenantId, workflowId],
  );

  return plain;
}

/**
 * Compute HMAC-SHA256 signature for webhook delivery.
 * Format: HMAC-SHA256(secret, "${timestamp}.${body}")
 */
export function computeWebhookSignature(secret: string, body: string, timestamp: number): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/**
 * Verify an incoming webhook signature.
 * Returns false if the workflow has no webhook secret configured.
 */
export async function verifyWebhookSignature(
  db: Db,
  tenantId: string,
  workflowId: string,
  body: string,
  timestamp: number,
  signature: string,
): Promise<boolean> {
  const result = await db.query<{ webhook_secret: string | null }>(
    'SELECT webhook_secret FROM workflows WHERE tenant_id = $1 AND id = $2',
    [tenantId, workflowId],
  );
  const row = result.rows[0];
  if (!row?.webhook_secret) return false;

  const expectedSig = computeWebhookSignature(row.webhook_secret, body, timestamp);
  return verifyWebhookSignatureHmac(signature, expectedSig);
}

/**
 * Verify webhook signature using HMAC approach (recommended over bcrypt for webhooks).
 * The caller must have the stored secret_hash and compute expected sig.
 */
export function verifyWebhookSignatureHmac(providedSig: string, expectedSig: string): boolean {
  try {
    const a = Buffer.from(providedSig, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
