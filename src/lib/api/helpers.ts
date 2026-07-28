/**
 * helpers.ts — API response helpers (apiSuccess, apiError, apiPaginated)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Standardizes API route responses: every endpoint returns the same JSON shape
 * with a consistent envelope (success/error), status code, and optional
 * metadata. Eliminates boilerplate in route handlers.
 *
 * HOW IT FITS
 * The documents API routes use these helpers to build NextResponse objects.
 * The frontend hooks parse the consistent response shape.
 */

import { NextResponse } from "next/server";

/** Standard success response envelope. */
export interface ApiSuccessResponse<T> {
  readonly success: true;
  readonly data: T;
}

/** Standard error response envelope. */
export interface ApiErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
}

/** Standard paginated response envelope. */
export interface ApiPaginatedResponse<T> {
  readonly success: true;
  readonly data: T[];
  readonly pagination: {
    readonly total: number;
    readonly limit: number;
    readonly offset: number;
  };
}

/** HTTP status codes used by the API. */
export type HttpStatusCode = 200 | 201 | 400 | 404 | 409 | 413 | 415 | 500;

/**
 * Build a success response.
 * @param data - The payload to return.
 * @param status - HTTP status code. Default 200.
 */
export function apiSuccess<T>(
  data: T,
  status: 200 | 201 = 200,
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true, data } satisfies ApiSuccessResponse<T>, {
    status,
  });
}

/**
 * Build a paginated success response.
 */
export function apiPaginated<T>(
  data: T[],
  total: number,
  limit: number,
  offset: number,
): NextResponse<ApiPaginatedResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      pagination: { total, limit, offset },
    } satisfies ApiPaginatedResponse<T>,
    { status: 200 },
  );
}

/**
 * Build an error response.
 * @param message - Human-readable error message.
 * @param status - HTTP status code. Default 500.
 * @param code - Machine-readable error code.
 * @param details - Optional additional error context.
 */
export function apiError(
  message: string,
  status: HttpStatusCode = 500,
  code = "INTERNAL_ERROR",
  details?: unknown,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: { code, message, details },
    } satisfies ApiErrorResponse,
    { status },
  );
}
