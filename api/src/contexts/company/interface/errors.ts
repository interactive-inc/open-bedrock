/**
 * Company interface の HTTP エラー集約。status と code を派生クラスへ内包し、呼び出し側は
 * エラー種別を選ぶだけにする（1ファイル1クラス規約の例外。lib/app-schemas.ts と同じ集約ファイル扱い）
 */
import { HTTPException } from "hono/http-exception"

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

export class CompanyInvalidBodyError extends CompanyHttpError {
  constructor(props?: { cause?: unknown }) {
    super({
      status: 400,
      code: "invalid_company_body",
      detail: "Company request body is invalid",
      cause: props?.cause,
    })
  }
}

export class CompanyInvalidBootstrapInputError extends CompanyHttpError {
  constructor(props?: { cause?: unknown }) {
    super({
      status: 400,
      code: "invalid_company_bootstrap_input",
      detail: "Company bootstrap request body is invalid",
      cause: props?.cause,
    })
  }
}

export class CompanyInvalidHeadersError extends CompanyHttpError {
  constructor(props?: { cause?: unknown }) {
    super({
      status: 400,
      code: "invalid_company_headers",
      detail: "Company request headers are invalid",
      cause: props?.cause,
    })
  }
}

export class CompanyInvalidQueryError extends CompanyHttpError {
  constructor(props?: { detail?: string; cause?: unknown }) {
    super({
      status: 400,
      code: "invalid_company_query",
      detail: props?.detail ?? "Company query is invalid",
      cause: props?.cause,
    })
  }
}

export class CompanyInvalidRequestError extends CompanyHttpError {
  constructor(props?: { cause?: unknown }) {
    super({
      status: 400,
      code: "invalid_company_request",
      detail: "Company request is invalid",
      cause: props?.cause,
    })
  }
}

export class CompanyInvalidOrganizationProfileError extends CompanyHttpError {
  constructor(props?: { cause?: unknown }) {
    super({
      status: 400,
      code: "invalid_organization_profile",
      detail: "Organization profile is invalid",
      cause: props?.cause,
    })
  }
}

export class CompanyAuthenticationRequiredError extends CompanyHttpError {
  constructor() {
    super({ status: 401, code: "authentication_required", detail: "Authentication is required" })
  }
}

export class CompanyAccessDeniedError extends CompanyHttpError {
  constructor() {
    super({
      status: 403,
      code: "company_access_denied",
      detail: "Company scope or capability is missing",
    })
  }
}

export class CompanyOrganizationAmbiguousError extends CompanyHttpError {
  constructor() {
    super({
      status: 403,
      code: "company_organization_ambiguous",
      detail: "Exactly one Company organization must be selected",
    })
  }
}

export class CompanyReadForbiddenError extends CompanyHttpError {
  constructor() {
    super({
      status: 403,
      code: "company_read_forbidden",
      detail: "Company read capability is required",
    })
  }
}

export class CompanyWriteForbiddenError extends CompanyHttpError {
  constructor(props?: { cause?: unknown }) {
    super({
      status: 403,
      code: "company_write_forbidden",
      detail: "Company write capability is required",
      cause: props?.cause,
    })
  }
}

export class CompanyForbiddenError extends CompanyHttpError {
  constructor() {
    super({
      status: 403,
      code: "forbidden",
      detail: "System administrator permission is required",
    })
  }
}

export class CompanyOrganizationProfileNotConfiguredError extends CompanyHttpError {
  constructor() {
    super({
      status: 404,
      code: "organization_profile_not_configured",
      detail: "Organization profile is not configured",
    })
  }
}

export class CompanyAlreadyInitializedError extends CompanyHttpError {
  constructor() {
    super({ status: 409, code: "already_initialized", detail: "Company is already initialized" })
  }
}

export class CompanyBootstrapConflictError extends CompanyHttpError {
  constructor() {
    super({
      status: 409,
      code: "company_bootstrap_conflict",
      detail: "Company is already initialized without this account link",
    })
  }
}

export class CompanyCommandConflictError extends CompanyHttpError {
  constructor() {
    super({ status: 409, code: "company_command_conflict", detail: "Idempotency key was reused" })
  }
}

export class CompanyResourceConflictError extends CompanyHttpError {
  constructor() {
    super({
      status: 409,
      code: "company_resource_conflict",
      detail: "Resource revision has changed",
    })
  }
}

export class CompanyRevisionConflictError extends CompanyHttpError {
  constructor(props?: { etag?: string }) {
    super({
      status: 409,
      code: "company_revision_conflict",
      detail: "Company revision has changed",
      etag: props?.etag,
    })
  }
}

export class CompanyInvalidResourceError extends CompanyHttpError {
  constructor() {
    super({
      status: 422,
      code: "invalid_company_resource",
      detail: "A Company resource is outside the requested organization",
    })
  }
}

export class CompanyBatchReadFailedError extends CompanyHttpError {
  constructor(props?: { cause?: unknown }) {
    super({
      status: 500,
      code: "batch_read_failed",
      detail: "バッチ実行状況を取得できませんでした。",
      cause: props?.cause,
    })
  }
}

export class CompanyOrganizationProfileReadFailedError extends CompanyHttpError {
  constructor(props?: { cause?: unknown }) {
    super({
      status: 500,
      code: "organization_profile_read_failed",
      detail: "Organization profile could not be read",
      cause: props?.cause,
    })
  }
}

export class CompanyOrganizationProfileWriteFailedError extends CompanyHttpError {
  constructor(props?: { cause?: unknown }) {
    super({
      status: 500,
      code: "organization_profile_write_failed",
      detail: "Organization profile could not be written",
      cause: props?.cause,
    })
  }
}

export class CompanyBootstrapUnavailableError extends CompanyHttpError {
  constructor(props?: { cause?: unknown }) {
    super({
      status: 503,
      code: "company_bootstrap_unavailable",
      detail: "Company bootstrap service is unavailable",
      cause: props?.cause,
    })
  }
}

export class CompanyDatabaseUnavailableError extends CompanyHttpError {
  constructor() {
    super({
      status: 503,
      code: "company_database_unavailable",
      detail: "Company storage is unavailable",
    })
  }
}

export class CompanyReadUnavailableError extends CompanyHttpError {
  constructor(props?: { cause?: unknown }) {
    super({
      status: 503,
      code: "company_read_unavailable",
      detail: "Company data could not be read",
      cause: props?.cause,
    })
  }
}

export class CompanyWriteUnavailableError extends CompanyHttpError {
  constructor(props?: { cause?: unknown }) {
    super({
      status: 503,
      code: "company_write_unavailable",
      detail: "Company change was not applied",
      cause: props?.cause,
    })
  }
}
