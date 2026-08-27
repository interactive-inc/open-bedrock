import { HTTPException } from "hono/http-exception"

type AdministrationHTTPExceptionProps = Readonly<{
  status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 423 | 429 | 500 | 502 | 503
  code: string
  message: string
  cause?: unknown
}>

export class AdministrationHTTPException extends HTTPException {
  readonly code: string

  constructor(props: AdministrationHTTPExceptionProps) {
    super(props.status, {
      message: props.message,
      ...(props.cause === undefined ? {} : { cause: props.cause }),
    })
    this.name = "AdministrationHTTPException"
    this.code = props.code
    Object.freeze(this)
  }
}
