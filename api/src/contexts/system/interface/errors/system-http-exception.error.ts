import { HTTPException } from "hono/http-exception"
import type { SystemHTTPExceptionProps } from "@system/interface/errors.shared"

/** SystemのHTTP境界で検出した失敗。JSONへの変換はAPIのonErrorだけが行う。 */
export class SystemHTTPException extends HTTPException {
  readonly code: string
  readonly detail: string
  readonly metadata: Readonly<Record<string, unknown>>

  constructor(props: SystemHTTPExceptionProps) {
    super(props.status, {
      message: props.detail,
      ...(props.cause === undefined ? {} : { cause: props.cause }),
    })
    this.name = new.target.name
    this.code = props.code
    this.detail = props.detail
    this.metadata = props.metadata ?? {}
  }
}
