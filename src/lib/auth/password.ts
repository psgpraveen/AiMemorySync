import * as argon2 from "@node-rs/argon2";
import { ValidationError } from "@/lib/errors";

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Hashes a plaintext password using Argon2id.
 *
 * @param password Plaintext password to hash
 * @returns Cryptographic Argon2id hash string
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== "string") {
    throw new ValidationError("Password is required");
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new ValidationError(`Password must not exceed ${MAX_PASSWORD_LENGTH} characters`);
  }

  return argon2.hash(password, {
    algorithm: 2, // Argon2id (default)
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    parallelism: 1,
  });
}

/**
 * Verifies a plaintext password against a stored Argon2id hash.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param password Plaintext candidate password
 * @param hash Stored Argon2id hash
 * @returns True if password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash || typeof password !== "string" || typeof hash !== "string") {
    return false;
  }

  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
