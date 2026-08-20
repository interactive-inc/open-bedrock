import { HTTPException } from "hono/http-exception"

type SystemHttpErrorStatus =
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

export class SystemHttpError extends HTTPException {
  readonly code: string
  readonly detail: string
  readonly metadata: Readonly<Record<string, unknown>>

  constructor(props: {
    status: SystemHttpErrorStatus
    code: string
    detail: string
    metadata?: Readonly<Record<string, unknown>>
    cause?: unknown
  }) {
    super(props.status, {
      message: props.detail,
      ...(props.cause === undefined ? {} : { cause: props.cause }),
    })
    this.name = "SystemHttpError"
    this.code = props.code
    this.detail = props.detail
    this.metadata = props.metadata ?? {}
    Object.freeze(this)
  }
}
