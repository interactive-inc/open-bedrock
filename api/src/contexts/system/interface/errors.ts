/**
 * System interface の HTTP エラー集約。status と code を派生クラスへ内包し、呼び出し側は
 * エラー種別を選ぶだけにする（1ファイル1クラス規約の例外。lib/app-schemas.ts と同じ集約ファイル扱い）
 */
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

export class SystemInvalidIdentityError extends SystemHttpError {
  constructor() {
    super({ status: 400, code: "invalid_identity", detail: "invalid identity" })
  }
}

export class SystemInvalidNotificationError extends SystemHttpError {
  constructor() {
    super({ status: 400, code: "invalid_notification", detail: "invalid notification" })
  }
}

export class SystemInvalidPasswordError extends SystemHttpError {
  constructor() {
    super({ status: 400, code: "invalid_password", detail: "invalid password" })
  }
}

export class SystemInvalidRoleError extends SystemHttpError {
  constructor() {
    super({ status: 400, code: "invalid_role", detail: "invalid role" })
  }
}

export class SystemInvalidRoleBindingError extends SystemHttpError {
  constructor() {
    super({ status: 400, code: "invalid_role_binding", detail: "invalid role binding" })
  }
}

export class SystemIdentityLoginDeniedError extends SystemHttpError {
  constructor() {
    super({ status: 401, code: "identity_login_denied", detail: "identity login denied" })
  }
}

export class SystemInvalidCliAuthorizationError extends SystemHttpError {
  constructor() {
    super({ status: 401, code: "invalid_cli_authorization", detail: "invalid CLI authorization" })
  }
}

export class SystemInvalidCliCodeError extends SystemHttpError {
  constructor() {
    super({ status: 401, code: "invalid_cli_code", detail: "invalid CLI code" })
  }
}

export class SystemInvalidCredentialError extends SystemHttpError {
  constructor() {
    super({ status: 401, code: "invalid_credential", detail: "invalid bootstrap credential" })
  }
}

export class SystemInvalidCredentialsError extends SystemHttpError {
  constructor() {
    super({ status: 401, code: "invalid_credentials", detail: "invalid credentials" })
  }
}

export class SystemInvalidLoginCodeError extends SystemHttpError {
  constructor() {
    super({ status: 401, code: "invalid_login_code", detail: "invalid or expired code" })
  }
}

export class SystemInvalidSessionError extends SystemHttpError {
  constructor() {
    super({ status: 401, code: "invalid_session", detail: "invalid session" })
  }
}

export class SystemForbiddenError extends SystemHttpError {
  constructor() {
    super({ status: 403, code: "forbidden", detail: "forbidden" })
  }
}

export class SystemSelfAssignmentError extends SystemHttpError {
  constructor() {
    super({ status: 403, code: "self_assignment", detail: "self assignment is forbidden" })
  }
}

export class SystemAccountNotFoundError extends SystemHttpError {
  constructor() {
    super({ status: 404, code: "account_not_found", detail: "account not found" })
  }
}

export class SystemAuditEventNotFoundError extends SystemHttpError {
  constructor() {
    super({ status: 404, code: "audit_event_not_found", detail: "audit event not found" })
  }
}

export class SystemIdentityNotFoundError extends SystemHttpError {
  constructor() {
    super({ status: 404, code: "identity_not_found", detail: "identity not found" })
  }
}

export class SystemNotFoundError extends SystemHttpError {
  constructor() {
    super({ status: 404, code: "not_found", detail: "not found" })
  }
}

export class SystemNotificationNotFoundError extends SystemHttpError {
  constructor() {
    super({ status: 404, code: "notification_not_found", detail: "notification not found" })
  }
}

export class SystemNotificationRecipientNotFoundError extends SystemHttpError {
  constructor() {
    super({
      status: 404,
      code: "notification_recipient_not_found",
      detail: "notification recipient not found",
    })
  }
}

export class SystemPasswordCredentialNotFoundError extends SystemHttpError {
  constructor() {
    super({
      status: 404,
      code: "password_credential_not_found",
      detail: "password credential not found",
    })
  }
}

export class SystemRoleBindingNotFoundError extends SystemHttpError {
  constructor() {
    super({ status: 404, code: "role_binding_not_found", detail: "role binding not found" })
  }
}

export class SystemRoleNotFoundError extends SystemHttpError {
  constructor() {
    super({ status: 404, code: "role_not_found", detail: "role not found" })
  }
}

export class SystemAccountConflictError extends SystemHttpError {
  constructor() {
    super({ status: 409, code: "account_conflict", detail: "account conflict" })
  }
}

export class SystemAlreadyInitializedError extends SystemHttpError {
  constructor() {
    super({ status: 409, code: "already_initialized", detail: "already initialized" })
  }
}

export class SystemIdentityConflictError extends SystemHttpError {
  constructor() {
    super({ status: 409, code: "identity_conflict", detail: "identity conflict" })
  }
}

export class SystemInvalidNotificationTransitionError extends SystemHttpError {
  constructor() {
    super({
      status: 409,
      code: "invalid_notification_transition",
      detail: "invalid notification transition",
    })
  }
}

export class SystemLastActiveIdentityError extends SystemHttpError {
  constructor() {
    super({ status: 409, code: "last_active_identity", detail: "last active identity" })
  }
}

export class SystemLastRootError extends SystemHttpError {
  constructor(props?: { detail?: string }) {
    super({ status: 409, code: "last_root", detail: props?.detail ?? "last root account" })
  }
}

export class SystemManagedRoleError extends SystemHttpError {
  constructor() {
    super({ status: 409, code: "managed_role", detail: "managed role is immutable" })
  }
}

export class SystemRoleBindingConflictError extends SystemHttpError {
  constructor() {
    super({ status: 409, code: "role_binding_conflict", detail: "role binding conflict" })
  }
}

export class SystemRoleConflictError extends SystemHttpError {
  constructor() {
    super({ status: 409, code: "role_conflict", detail: "role conflict" })
  }
}

export class SystemRoleInUseError extends SystemHttpError {
  constructor() {
    super({ status: 409, code: "role_in_use", detail: "role is in use" })
  }
}

export class SystemAuthenticationRateLimitedError extends SystemHttpError {
  constructor() {
    super({ status: 429, code: "authentication_rate_limited", detail: "too many requests" })
  }
}

export class SystemInternalServerError extends SystemHttpError {
  constructor(props?: { cause?: unknown }) {
    super({
      status: 500,
      code: "internal_server_error",
      detail: "処理に失敗しました。",
      cause: props?.cause,
    })
  }
}

export class SystemAccountUnavailableError extends SystemHttpError {
  constructor() {
    super({ status: 503, code: "account_unavailable", detail: "account service unavailable" })
  }
}

export class SystemAuditUnavailableError extends SystemHttpError {
  constructor() {
    super({ status: 503, code: "audit_unavailable", detail: "audit service unavailable" })
  }
}

export class SystemBootstrapUnavailableError extends SystemHttpError {
  constructor() {
    super({ status: 503, code: "bootstrap_unavailable", detail: "bootstrap service unavailable" })
  }
}

export class SystemBrowserLoginCodeUnavailableError extends SystemHttpError {
  constructor() {
    super({
      status: 503,
      code: "browser_login_code_unavailable",
      detail: "browser login is unavailable",
    })
  }
}

export class SystemCliLoginUnavailableError extends SystemHttpError {
  constructor() {
    super({ status: 503, code: "cli_login_unavailable", detail: "CLI login is unavailable" })
  }
}

export class SystemIamUnavailableError extends SystemHttpError {
  constructor() {
    super({ status: 503, code: "iam_unavailable", detail: "IAM service unavailable" })
  }
}

export class SystemIdentityLoginUnavailableError extends SystemHttpError {
  constructor() {
    super({
      status: 503,
      code: "identity_login_unavailable",
      detail: "identity login is unavailable",
    })
  }
}

export class SystemIdentityUnavailableError extends SystemHttpError {
  constructor() {
    super({ status: 503, code: "identity_unavailable", detail: "identity service unavailable" })
  }
}

export class SystemNotificationUnavailableError extends SystemHttpError {
  constructor() {
    super({
      status: 503,
      code: "notification_unavailable",
      detail: "notification service unavailable",
    })
  }
}

export class SystemPasswordUnavailableError extends SystemHttpError {
  constructor() {
    super({ status: 503, code: "password_unavailable", detail: "password service unavailable" })
  }
}

export class SystemSessionUnavailableError extends SystemHttpError {
  constructor() {
    super({ status: 503, code: "session_unavailable", detail: "session service unavailable" })
  }
}

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

export class OidcInvalidGrantError extends OidcHttpError {
  constructor(props?: { cause?: unknown }) {
    super({ code: "invalid_grant", cause: props?.cause })
  }
}

export class OidcInvalidRequestError extends OidcHttpError {
  constructor(props?: { cause?: unknown }) {
    super({ code: "invalid_request", cause: props?.cause })
  }
}

export class OidcInvalidScopeError extends OidcHttpError {
  constructor(props?: { cause?: unknown }) {
    super({ code: "invalid_scope", cause: props?.cause })
  }
}

export class OidcInvalidTokenError extends OidcHttpError {
  constructor(props?: { cause?: unknown }) {
    super({
      code: "invalid_token",
      status: 401,
      authenticate: 'Bearer error="invalid_token"',
      cause: props?.cause,
    })
  }
}

export class OidcTemporarilyUnavailableError extends OidcHttpError {
  constructor(props?: { cause?: unknown }) {
    super({ code: "temporarily_unavailable", status: 503, cause: props?.cause })
  }
}
