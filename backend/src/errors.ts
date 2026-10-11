export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "INTERNAL_ERROR";

/** Error that is safe to show to the client (mapped to an HTTP status in middleware). */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const validationError = (message: string, details?: unknown) =>
  new AppError("VALIDATION_ERROR", 400, message, details);

export const notFound = (message: string) => new AppError("NOT_FOUND", 404, message);

export const invalidTransition = (message: string) =>
  new AppError("INVALID_TRANSITION", 409, message);
