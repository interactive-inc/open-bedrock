export type CompanyHttpErrorStatus =
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

type Props = Readonly<{
  status: CompanyHttpErrorStatus
  code: string
  detail: string
  etag?: string
  issues?: readonly unknown[]
  metadata?: Readonly<Record<string, unknown>>
  cause?: unknown
}>

/**
 * Company の HTTP 境界で検出した失敗。JSON への変換は API の onError だけが行う。
 */
export class CompanyHttpError extends HTTPException {
  override readonly status: CompanyHttpErrorStatus

  constructor(private readonly props: Props) {
    super(props.status, {
      message: props.detail,
      ...(props.cause === undefined ? {} : { cause: props.cause }),
    })
    this.name = "CompanyHttpError"
    this.status = props.status
    Object.freeze(this)
  }

  get code(): string {
    return this.props.code
  }

  get detail(): string {
    return this.props.detail
  }

  get etag(): string | null {
    return this.props.etag ?? null
  }

  get issues(): readonly unknown[] | null {
    return this.props.issues ?? null
  }

  get metadata(): Readonly<Record<string, unknown>> {
    return this.props.metadata ?? {}
  }
}
import { HTTPException } from "hono/http-exception"
