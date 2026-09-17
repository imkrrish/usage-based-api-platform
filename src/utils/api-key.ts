import { randomBytes } from 'crypto';

/**
 * Generates a cryptographically secure API key
 * @param bytes - Number of random bytes (default 32 for 256-bit security)
 * @returns A hex-encoded API key string
 */
export function generateApiKey(bytes: number = 32): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Generates a unique deployment identifier
 * Uses timestamp + random bytes for uniqueness
 * @returns A unique deployment ID string
 */
export function generateDeploymentId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(8).toString('hex');
  return `dep_${timestamp}_${random}`;
}
