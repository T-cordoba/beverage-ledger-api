import { createHash, randomBytes } from 'node:crypto';

/**
 * 384 bits, base64url so it survives a URL and a cookie unescaped.
 *
 * Long enough that guessing is not a threat model, which is what lets the hash
 * below be a plain digest.
 */
export function createOpaqueToken(): string {
  return randomBytes(48).toString('base64url');
}

/**
 * What gets stored, so a leaked backup hands out nothing.
 *
 * SHA-256 rather than argon2: the token is uniform random, so there is no
 * low-entropy secret for a work factor to protect. Argon2 would only tax every
 * verification.
 */
export function fingerprint(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
