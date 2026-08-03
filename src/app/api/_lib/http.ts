import type { ErrorCode } from "./errors";
import {
  INVALID_JSON,
  VALIDATION_ERROR,
  INVALID_IMO,
  VESSEL_NOT_FOUND,
  NOT_FOUND,
  INTEGRITY_ERROR,
  RATE_LIMITED,
  UPSTREAM_ERROR,
  MALFORMED_RESPONSE,
  CONFIGURATION_ERROR,
  REPOSITORY_UNAVAILABLE,
  INTERNAL_ERROR,
} from "./errors";
export function apiSuccess<T>(data: T, status = 200): Response {
  return Response.json({ success: true, data }, { status });
}

export function apiCreated<T>(data: T): Response {
  return apiSuccess(data, 201);
}

export function apiError(
  code: ErrorCode,
  message: string,
  status: number,
  details?: Array<{ path: string; message: string }>,
): Response {
  const error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly details?: Array<{ path: string; message: string }>;
  } = { code, message };
  if (details && details.length > 0) {
    Object.defineProperty(error, "details", { value: details, enumerable: true });
  }
  return Response.json({ success: false, error }, { status });
}

interface ErrorMapping {
  readonly code: ErrorCode;
  readonly status: number;
}

export function httpStatusForError(err: unknown): ErrorMapping {
  if (err instanceof Error) {
    const name = err.constructor.name;

    if (name === "InvalidIMOError") {
      return { code: INVALID_IMO, status: 400 };
    }
    if (name === "VesselNotFoundError") {
      return { code: VESSEL_NOT_FOUND, status: 404 };
    }
    if (name === "RateLimitError") {
      return { code: RATE_LIMITED, status: 429 };
    }
    if (name === "TimeoutError") {
      return { code: UPSTREAM_ERROR, status: 502 };
    }
    if (name === "UpstreamError") {
      return { code: UPSTREAM_ERROR, status: 502 };
    }
    if (name === "MalformedResponseError") {
      return { code: MALFORMED_RESPONSE, status: 502 };
    }
    if (name === "ConfigurationError") {
      return { code: CONFIGURATION_ERROR, status: 500 };
    }
    if (name === "RepositoryIntegrityError") {
      return { code: INTEGRITY_ERROR, status: 409 };
    }
    if (name === "RepositoryUpstreamError") {
      return { code: REPOSITORY_UNAVAILABLE, status: 503 };
    }
    if (name === "SupabaseConfigError") {
      return { code: CONFIGURATION_ERROR, status: 500 };
    }
    if (name === "RepositoryError") {
      return { code: REPOSITORY_UNAVAILABLE, status: 503 };
    }
    if (name === "ReportNotFoundError") {
      return { code: NOT_FOUND, status: 404 };
    }
    if (name === "ReportGenerationError") {
      return { code: INTERNAL_ERROR, status: 500 };
    }
    if (name === "PackageNotFoundError") {
      return { code: NOT_FOUND, status: 404 };
    }
    if (name === "PackageGenerationError") {
      return { code: INTERNAL_ERROR, status: 500 };
    }
    if (name === "NotificationNotFoundError") {
      return { code: NOT_FOUND, status: 404 };
    }
    if (name === "PackageValidationError") {
      return { code: VALIDATION_ERROR, status: 400 };
    }
    if (name === "InvalidCredentialsError") {
      return { code: "INVALID_CREDENTIALS", status: 401 };
    }
    if (name === "UserNotActiveError") {
      return { code: "FORBIDDEN", status: 403 };
    }
    if (name === "InvalidSessionError") {
      return { code: "INVALID_SESSION", status: 401 };
    }
    if (name === "InvalidResetTokenError") {
      return { code: "INVALID_RESET_TOKEN", status: 400 };
    }
    if (name === "OrganizationNotFoundError") {
      return { code: "ORGANIZATION_NOT_FOUND", status: 404 };
    }
    if (name === "UserNotFoundError") {
      return { code: "USER_NOT_FOUND", status: 404 };
    }
    if (name === "InviteNotFoundError") {
      return { code: "INVITE_NOT_FOUND", status: 404 };
    }
    if (name === "InviteConflictError") {
      return { code: "INVITE_CONFLICT", status: 409 };
    }
    if (name === "CannotDeactivateLastOwnerError") {
      return { code: "LAST_OWNER", status: 409 };
    }
    if (name === "CannotDemoteSelfError") {
      return { code: "FORBIDDEN", status: 403 };
    }
    if (name === "InvalidIntegrationError") {
      return { code: "INVALID_INTEGRATION", status: 400 };
    }
  }

  return { code: INTERNAL_ERROR, status: 500 };
}

export function mapErrorResponse(err: unknown): Response {
  if (err instanceof Error) {
    const name = err.constructor.name;
    if (name === "RateLimitError") {
      const retryAfter = (err as { retryAfterSeconds?: number }).retryAfterSeconds;
      const res = apiError(RATE_LIMITED, err.message, 429);
      if (retryAfter != null) {
        res.headers.set("Retry-After", String(retryAfter));
      }
      return res;
    }
  }

  const { code, status } = httpStatusForError(err);
  const message = err instanceof Error ? err.message : String(err);
  return apiError(code, message, status);
}

export async function parseJsonBody<T = unknown>(
  request: Request,
): Promise<T | null> {
  try {
    const text = await request.text();
    if (!text.trim()) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function parseQueryNumber(
  params: URLSearchParams,
  key: string,
): number | undefined {
  const raw = params.get(key);
  if (raw === null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function requireQueryParam(
  params: URLSearchParams,
  key: string,
): string | null {
  const val = params.get(key);
  if (!val) return null;
  return val;
}
