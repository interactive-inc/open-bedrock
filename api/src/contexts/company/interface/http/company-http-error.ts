type Props = Readonly<{
  status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 500 | 503
  code: string
  detail: string
  etag?: string
  issues?: readonly unknown[]
  cause?: unknown
}>

/**
 * Company の HTTP 境界で検出した失敗。JSON への変換は API の onError だけが行う。
 */
export class CompanyHttpError extends Error {
  constructor(private readonly props: Props) {
    super(props.detail, props.cause === undefined ? undefined : { cause: props.cause })
    this.name = "CompanyHttpError"
    Object.freeze(this)
  }

  get status(): Props["status"] {
    return this.props.status
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
}
