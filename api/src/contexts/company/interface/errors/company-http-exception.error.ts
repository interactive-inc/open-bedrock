import { HTTPException } from "hono/http-exception"
import type {
  CompanyHTTPExceptionStatus,
  CompanyHTTPExceptionProps,
} from "@/contexts/company/interface/errors.shared"

/**
 * Company の HTTP 境界で検出した失敗。JSON への変換は API の onError だけが行う。
 */
export class CompanyHTTPException extends HTTPException {
  override readonly status: CompanyHTTPExceptionStatus

  constructor(private readonly props: CompanyHTTPExceptionProps) {
    super(props.status, {
      message: props.detail,
      ...(props.cause === undefined ? {} : { cause: props.cause }),
    })
    this.name = new.target.name
    this.status = props.status
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
