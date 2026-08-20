export type OidcHttpErrorCode =
  | "invalid_grant"
  | "invalid_request"
  | "invalid_scope"
  | "invalid_token"
  | "temporarily_unavailable"

export class OidcHttpError extends HTTPException {
  readonly code: OidcHttpErrorCode
  readonly authenticate: string | null

  constructor(props: {
    code: OidcHttpErrorCode
    status?: 400 | 401 | 503
    authenticate?: string
    cause?: unknown
  }) {
    super(props.status ?? 400, {
      message: props.code,
      ...(props.cause === undefined ? {} : { cause: props.cause }),
    })
    this.name = "OidcHttpError"
    this.code = props.code
    this.authenticate = props.authenticate ?? null
    Object.freeze(this)
  }
}
import { HTTPException } from "hono/http-exception"
