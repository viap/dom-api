import { createHash, timingSafeEqual } from 'crypto';

// Constant-time comparison that also hides the secret length.
export function isSameSecret(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left).digest();
  const rightDigest = createHash('sha256').update(right).digest();

  return timingSafeEqual(
    new Uint8Array(leftDigest),
    new Uint8Array(rightDigest),
  );
}
