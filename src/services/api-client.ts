import type { Page } from "@/lib/supabase/types";

export interface ApiSuccessEnvelope<T> {
  readonly success: true;
  readonly data: T;
}

export interface ApiErrorEnvelope {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: ReadonlyArray<{ readonly path: string; readonly message: string }>;
  };
}

export type ApiResponse<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: ReadonlyArray<{ readonly path: string; readonly message: string }>;

  constructor(
    code: string,
    message: string,
    status: number,
    details?: ReadonlyArray<{ readonly path: string; readonly message: string }>,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = path.startsWith("/") ? path : `/api/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const body = (await res.json()) as ApiResponse<T>;

  if (!body.success) {
    throw new ApiError(
      body.error.code,
      body.error.message,
      res.status,
      body.error.details,
    );
  }

  return body.data;
}

export const DEFAULT_PAGE_SIZE = 20;

export interface PaginationParams {
  readonly limit?: number;
  readonly offset?: number;
}

export function pageOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

export type { Page };
