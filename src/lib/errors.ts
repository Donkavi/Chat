export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "LOCATION_REQUIRED"
  | "BLOCKED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  LOCATION_REQUIRED: 409,
  BLOCKED: 403,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INTERNAL: 500,
};

/** An error whose message is safe to show to the client. Anything else becomes a generic 500. */
export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
    readonly retryAfterSec?: number,
  ) {
    super(message);
    this.status = STATUS[code];
  }
}

export const notFound = (what = "Not found") => new AppError("NOT_FOUND", what);
export const forbidden = (msg = "You don't have access to this.") => new AppError("FORBIDDEN", msg);
