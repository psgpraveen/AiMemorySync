/**
 * Standard successful API response envelope from AiMemorySync backend.
 */
export interface ApiResponse<T> {
  data: T;
}

/**
 * Standard error response envelope from AiMemorySync backend.
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Common pagination options for list endpoints.
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}
