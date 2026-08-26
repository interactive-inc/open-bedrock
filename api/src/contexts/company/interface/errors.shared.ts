export type CompanyHTTPExceptionStatus =
  | 400
  | 401
  | 403
  | 404
  | 409
  | 413
  | 415
  | 422
  | 423
  | 429
  | 500
  | 502
  | 503
export type CompanyHTTPExceptionProps = Readonly<{
  status: CompanyHTTPExceptionStatus
  code: string
  detail: string
  etag?: string
  issues?: readonly unknown[]
  metadata?: Readonly<Record<string, unknown>>
  cause?: unknown
}>
