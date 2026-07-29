export abstract class GoogleOcrError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class GoogleOcrConfigError extends GoogleOcrError {}

export class GoogleOcrAuthError extends GoogleOcrError {}

export class GoogleOcrApiError extends GoogleOcrError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}

export class GoogleOcrTimeoutError extends GoogleOcrError {}

export class GoogleOcrRateLimitError extends GoogleOcrError {}

export class GoogleOcrInvalidResponseError extends GoogleOcrError {}
