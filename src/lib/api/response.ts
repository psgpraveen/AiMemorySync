import { NextResponse } from "next/server";
import { ValidationError } from "@/lib/errors";

/**
 * Returns a standardized 200 OK JSON response with { data }.
 */
export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

/**
 * Returns a standardized 201 Created JSON response with { data }.
 */
export function createdResponse<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

/**
 * Safely parses the JSON request body.
 * Throws a ValidationError if the body is empty or contains malformed JSON.
 */
export async function parseJsonBody<T = unknown>(request: Request): Promise<T> {
  try {
    const text = await request.text();
    if (!text || text.trim() === "") {
      throw new ValidationError("Request body cannot be empty");
    }
    return JSON.parse(text) as T;
  } catch (err) {
    if (err instanceof ValidationError) {
      throw err;
    }
    throw new ValidationError("Invalid JSON format in request body");
  }
}
