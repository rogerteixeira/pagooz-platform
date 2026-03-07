export type ErrorType =
  | "invalid_request_error"
  | "authentication_error"
  | "permission_error"
  | "api_error";

export interface ApiErrorBody {
  error: {
    type: ErrorType;
    code: string;
    message: string;
  };
}
