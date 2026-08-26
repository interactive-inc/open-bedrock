export type HTTPErrorBodyInput = Readonly<
  { error: string; message?: string } & Record<string, unknown>
>
export type HTTPErrorBody = Readonly<{ error: string; message: string } & Record<string, unknown>>
export type SystemHTTPExceptionStatus =
  | 400
  | 401
  | 403
  | 404
  | 405
  | 409
  | 413
  | 415
  | 422
  | 423
  | 429
  | 500
  | 502
  | 503
export type SystemHTTPExceptionProps = Readonly<{
  status: SystemHTTPExceptionStatus
  code: string
  detail: string
  metadata?: Readonly<Record<string, unknown>>
  cause?: unknown
}>
export type SystemApplicationFailure = Readonly<{
  status: SystemHTTPExceptionStatus
  body: Readonly<{ error: string; message: string } & Record<string, unknown>>
}>
export type OIDCHTTPExceptionCode =
  | "invalid_grant"
  | "invalid_request"
  | "invalid_scope"
  | "invalid_token"
  | "method_not_allowed"
  | "not_found"
  | "temporarily_unavailable"
