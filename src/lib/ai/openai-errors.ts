export abstract class OpenAiError extends Error {
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

export class OpenAiConfigError extends OpenAiError {}

export class OpenAiAuthError extends OpenAiError {}

export class OpenAiApiError extends OpenAiError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}

export class OpenAiTimeoutError extends OpenAiError {}

export class OpenAiRateLimitError extends OpenAiError {}

export class OpenAiInvalidResponseError extends OpenAiError {}
