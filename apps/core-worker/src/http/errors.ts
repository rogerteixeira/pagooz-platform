import type { ApiErrorBody, ErrorType } from "../contracts/api";

export class AppError extends Error {
  readonly status: number;
  readonly type: ErrorType;
  readonly code: string;

  constructor(options: {
    status: number;
    type: ErrorType;
    code: string;
    message: string;
  }) {
    super(options.message);
    this.status = options.status;
    this.type = options.type;
    this.code = options.code;
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        type: this.type,
        code: this.code,
        message: this.message,
      },
    };
  }
}

export function invalidRequest(code: string, message: string): AppError {
  return new AppError({
    status: 400,
    type: "invalid_request_error",
    code,
    message,
  });
}

export function unauthorized(code: string, message: string): AppError {
  return new AppError({
    status: 401,
    type: "authentication_error",
    code,
    message,
  });
}

export function forbidden(code: string, message: string): AppError {
  return new AppError({
    status: 403,
    type: "permission_error",
    code,
    message,
  });
}

export function notFound(code: string, message: string): AppError {
  return new AppError({
    status: 404,
    type: "invalid_request_error",
    code,
    message,
  });
}

export function internalError(code: string, message: string): AppError {
  return new AppError({
    status: 500,
    type: "api_error",
    code,
    message,
  });
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  return internalError("internal_error", "An unexpected error occurred.");
}
