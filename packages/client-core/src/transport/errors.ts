/**
 * Base error class for all AiMemorySync SDK operations.
 */
export class AiMemoryError extends Error {
  public readonly code: string;
  public readonly status?: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: string = "SDK_ERROR",
    status?: number,
    details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an endpoint returns HTTP 401 (Missing, invalid, expired, or revoked API key).
 */
export class AuthenticationError extends AiMemoryError {
  constructor(
    message: string = "Authentication required. Invalid, expired, or missing API key.",
    details?: unknown
  ) {
    super(message, "UNAUTHORIZED", 401, details);
  }
}

/**
 * Thrown when an endpoint returns HTTP 403 (Insufficient permissions or scopes).
 */
export class AuthorizationError extends AiMemoryError {
  constructor(
    message: string = "Access forbidden. Insufficient permissions or scopes for this operation.",
    details?: unknown
  ) {
    super(message, "FORBIDDEN", 403, details);
  }
}

/**
 * Thrown when an endpoint returns HTTP 404 (Project, memory, or resource not found).
 */
export class NotFoundError extends AiMemoryError {
  constructor(
    message: string = "Requested resource not found.",
    details?: unknown
  ) {
    super(message, "NOT_FOUND", 404, details);
  }
}

/**
 * Thrown when an endpoint returns HTTP 409 (Slug collision or duplicate memory hash).
 */
export class ConflictError extends AiMemoryError {
  constructor(
    message: string = "Resource conflict or duplicate detected.",
    details?: unknown
  ) {
    super(message, "CONFLICT", 409, details);
  }
}

/**
 * Thrown when an endpoint returns HTTP 400 (Zod schema validation failure).
 */
export class ValidationError extends AiMemoryError {
  constructor(
    message: string = "Request validation failed.",
    details?: unknown
  ) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

/**
 * Thrown when an endpoint returns HTTP 429 (Rate limit exceeded).
 */
export class RateLimitError extends AiMemoryError {
  public readonly retryAfterSecs?: number;

  constructor(
    message: string = "Rate limit exceeded. Please slow down.",
    retryAfterSecs?: number,
    details?: unknown
  ) {
    super(message, "RATE_LIMIT_EXCEEDED", 429, details);
    this.retryAfterSecs = retryAfterSecs;
  }
}

/**
 * Thrown when a low-level network failure occurs (DNS lookup failure, connection refused, connection reset).
 */
export class NetworkError extends AiMemoryError {
  constructor(
    message: string = "Network request failed. Host unreachable.",
    details?: unknown
  ) {
    super(message, "NETWORK_ERROR", undefined, details);
  }
}

/**
 * Thrown when a request exceeds the configured timeout threshold.
 */
export class TimeoutError extends AiMemoryError {
  constructor(
    message: string = "Request timed out.",
    details?: unknown
  ) {
    super(message, "TIMEOUT", 408, details);
  }
}

/**
 * Thrown when an endpoint returns an unhandled HTTP 5xx server error.
 */
export class ServerError extends AiMemoryError {
  constructor(
    message: string = "Internal server error.",
    status: number = 500,
    details?: unknown
  ) {
    super(message, "SERVER_ERROR", status, details);
  }
}
