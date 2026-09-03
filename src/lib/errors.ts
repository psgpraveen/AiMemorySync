/**
 * Core Domain Errors for AiMemorySync
 * Provides typed, structured domain errors that can be consistently mapped to API HTTP responses.
 */

export type DomainErrorCode =
  | "PROJECT_NOT_FOUND"
  | "MEMORY_NOT_FOUND"
  | "PROJECT_SLUG_CONFLICT"
  | "MEMORY_DUPLICATE"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMIT_EXCEEDED"
  | "INTERNAL_ERROR";

export class DomainError extends Error {
  public readonly code: DomainErrorCode;
  public readonly details?: unknown;

  constructor(message: string, code: DomainErrorCode, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string, code: DomainErrorCode, details?: unknown) {
    super(message, code, details);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", details);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, code: DomainErrorCode, details?: unknown) {
    super(message, code, details);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string = "Authentication required. Provide a valid Bearer API key.", details?: unknown) {
    super(message, "UNAUTHORIZED", details);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string = "Access forbidden. Insufficient permissions or scopes.", details?: unknown) {
    super(message, "FORBIDDEN", details);
  }
}

export class RateLimitError extends DomainError {
  constructor(message: string = "Too many requests. Please slow down.", details?: unknown) {
    super(message, "RATE_LIMIT_EXCEEDED", details);
  }
}

