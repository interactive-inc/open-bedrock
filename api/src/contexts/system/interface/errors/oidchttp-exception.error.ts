import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"
import type { OIDCHTTPExceptionCode } from "@system/interface/errors.shared"

export abstract class OIDCHTTPException extends SystemHTTPException {
  readonly allow: string | null
  readonly authenticate: string | null

  constructor(props: {
    code: OIDCHTTPExceptionCode
    status?: 400 | 401 | 404 | 405 | 503
    allow?: string
    authenticate?: string
    cause?: unknown
  }) {
    super({
      status: props.status ?? 400,
      code: props.code,
      detail: props.code,
      ...(props.cause === undefined ? {} : { cause: props.cause }),
    })
    this.allow = props.allow ?? null
    this.authenticate = props.authenticate ?? null
  }
}
