import crypto from "crypto";

/**
 * Normalizes text content deterministically to ensure semantic equivalence.
 *
 * Rules:
 * 1. Standardize line endings to Unix LF (\n)
 * 2. Trim trailing whitespace from each line
 * 3. Collapse 3+ consecutive newlines to 2 newlines (\n\n)
 * 4. Trim leading and trailing whitespace from the overall text
 * 5. Preserves capitalization, punctuation, and markdown formatting intact.
 */
export function normalizeContent(content: string): string {
  if (!content) return "";

  return content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Normalizes memory title deterministically.
 * Trims leading/trailing whitespace and collapses internal multiple whitespace to single space.
 */
export function normalizeTitle(title: string): string {
  if (!title) return "";
  return title.trim().replace(/\s+/g, " ");
}

/**
 * Normalizes project slug deterministically into a URL-safe format.
 * Lowercase, alphanumeric characters and hyphens only, trimmed of leading/trailing hyphens.
 */
export function normalizeSlug(slug: string): string {
  if (!slug) return "";
  return slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/**
 * Generates a deterministic SHA-256 hash for a memory item.
 *
 * Canonical representation:
 * `${normalizedType}\n${normalizedTitle}\n${normalizedContent}`
 *
 * @param type Memory type enum string (e.g. DECISION, REQUIREMENT)
 * @param title Title of the memory
 * @param content Full content/markdown body of the memory
 * @returns 64-character lowercase hexadecimal SHA-256 hash string
 */
export function generateMemoryHash(
  type: string,
  title: string,
  content: string
): string {
  const normalizedType = type.trim().toUpperCase();
  const normalizedTitle = normalizeTitle(title);
  const normalizedBody = normalizeContent(content);

  const canonicalString = `${normalizedType}\n${normalizedTitle}\n${normalizedBody}`;

  return crypto
    .createHash("sha256")
    .update(canonicalString, "utf8")
    .digest("hex");
}
