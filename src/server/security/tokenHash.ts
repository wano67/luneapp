import crypto from 'crypto';

/** SHA-256 hash for token storage. Same pattern as RefreshToken & ProjectShareToken. */
export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('base64url');
}

/** Generate a cryptographically secure random token (base64url). */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}
