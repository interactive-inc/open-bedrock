/**
 * application 層のエラー基底。HTTP status と応答 body を持ち、interface が onError で JSON 化する。
 * 製品に依存しない基盤なので system が所有し、全 context がここから継承する。
 */
export type ApplicationErrorBody = Readonly<
  { error: string; message: string } & Record<string, unknown>
>
export type ApplicationErrorStatus =
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
export type ApplicationErrorOptions = Readonly<{ cause?: unknown }>
