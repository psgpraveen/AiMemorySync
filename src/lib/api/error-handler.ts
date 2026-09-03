import { NextResponse } from "next/server";
import {
  DomainError,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
} from "@/lib/errors";

/**
 * Standardized API error mapper.
 * Maps known domain errors to appropriate HTTP status codes:
 * - ValidationError   -> 400 Bad Request
 * - UnauthorizedError -> 401 Unauthorized
 * - ForbiddenError    -> 403 Forbidden
 * - NotFoundError     -> 404 Not Found
 * - ConflictError     -> 409 Conflict
 * - RateLimitError    -> 429 Too Many Requests
 * - DomainError       -> 400 Bad Request
 * - Unknown/Generic   -> 500 Internal Server Error (without leaking raw details or stack traces)
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined && { details: error.details }),
        },
      },
      { status: 400 }
    );
  }

  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined && { details: error.details }),
        },
      },
      { status: 401 }
    );
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined && { details: error.details }),
        },
      },
      { status: 403 }
    );
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined && { details: error.details }),
        },
      },
      { status: 404 }
    );
  }

  if (error instanceof ConflictError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined && { details: error.details }),
        },
      },
      { status: 409 }
    );
  }

  if (error instanceof RateLimitError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined && { details: error.details }),
        },
      },
      { status: 429 }
    );
  }

  if (error instanceof DomainError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined && { details: error.details }),
        },
      },
      { status: 400 }
    );
  }


  // Safe server logging for unexpected internal errors
  console.error(
    "[API_INTERNAL_ERROR]",
    error instanceof Error ? error.message : "Unknown error"
  );

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    },
    { status: 500 }
  );
}
