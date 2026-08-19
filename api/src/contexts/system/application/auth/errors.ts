import {
  ApplicationBadRequestError,
  ApplicationConflictError,
  ApplicationForbiddenError,
  ApplicationInternalError,
  ApplicationNotFoundError,
  ApplicationTooManyRequestsError,
  ApplicationUnauthorizedError,
} from "@/lib/errors/application-error"

export class AuthAccountNotFoundApplicationError extends ApplicationNotFoundError {
  constructor(userId: string, cause?: unknown) {
    super(
      {
        error: "account.not_found",
        message: "指定されたアカウントが見つかりません。",
        userId,
      },
      { cause },
    )
  }
}

export class AuthAccountDisabledApplicationError extends ApplicationBadRequestError {
  constructor(userId: string) {
    super({
      error: "account.disabled",
      message: "無効化されているアカウントのパスワードは発行できません。",
      userId,
    })
  }
}

export class RootGrantPasswordForbiddenApplicationError extends ApplicationForbiddenError {
  constructor() {
    super({
      error: "iam.root_grant_forbidden",
      message: "システム管理者アカウントのパスワードを発行する権限がありません。",
    })
  }
}

export class InternalRootGrantPasswordForbiddenApplicationError extends ApplicationForbiddenError {
  constructor(userId: string) {
    super({
      error: "root_role_forbidden",
      message: "システム管理者アカウントの初期パスワードはこの経路では設定できません。",
      userId,
    })
  }
}

export class PasswordIdentityNotFoundApplicationError extends ApplicationNotFoundError {
  constructor(userId: string) {
    super({
      error: "identity_not_found",
      message: "対象のパスワード認証情報が見つかりません。",
      userId,
    })
  }
}

export class PasswordIdentityMissingApplicationError extends ApplicationBadRequestError {
  constructor(userId: string) {
    super({
      error: "account.no_password_identity",
      message: "このアカウントにはパスワード認証が設定されていません。",
      userId,
    })
  }
}

export class PasswordAlreadySetApplicationError extends ApplicationConflictError {
  constructor(userId: string) {
    super({
      error: "password_already_set",
      message: "このアカウントにはすでにパスワードが設定されています。",
      userId,
    })
  }
}

export class PepperSecretMissingApplicationError extends ApplicationInternalError {
  constructor() {
    super({
      error: "pepper_secret_missing",
      message: "パスワード機能の設定に問題があります。管理者にお問い合わせください。",
    })
  }
}

export class SystemAuthPersistenceApplicationError extends ApplicationInternalError {
  constructor(cause?: unknown) {
    super(
      {
        error: "authentication_persistence_failed",
        message: "認証情報を保存できませんでした。時間をおいてもう一度お試しください。",
      },
      { cause },
    )
  }
}

export class JwtSecretMissingApplicationError extends ApplicationInternalError {
  constructor() {
    super({
      error: "jwt_secret_missing",
      message: "ログイン機能の設定に問題があります。管理者にお問い合わせください。",
    })
  }
}

export class PasswordResetRequestApplicationError extends ApplicationInternalError {
  constructor(cause?: unknown) {
    super(
      {
        error: "password_reset_request_failed",
        message: "再設定メールの受付処理に失敗しました。時間をおいてもう一度お試しください。",
      },
      { cause },
    )
  }
}

export class PasswordResetTokenInvalidApplicationError extends ApplicationBadRequestError {
  constructor(cause?: unknown) {
    super(
      {
        error: "reset.token_invalid",
        message: "再設定リンクが正しくありません。もう一度メールを発行してください。",
        item: null,
      },
      { cause },
    )
  }
}

export class InvalidInternalCredentialsApplicationError extends ApplicationUnauthorizedError {
  constructor() {
    super({
      error: "invalid_credentials",
      message: "ユーザーIDまたはパスワードが正しくありません。",
      item: null,
    })
  }
}

export class InternalAuthRateLimitedApplicationError extends ApplicationTooManyRequestsError {
  constructor() {
    super({
      error: "rate_limited",
      message: "試行回数が上限に達しました。しばらく待ってからもう一度お試しください。",
      item: null,
    })
  }
}

export class OidcInvalidTokenApplicationError extends Error {
  constructor(cause?: unknown) {
    super("The OIDC access token is invalid.", { cause })
    this.name = "OidcInvalidTokenApplicationError"
  }
}

export class OidcTemporarilyUnavailableApplicationError extends Error {
  constructor(cause?: unknown) {
    super("OIDC user information is temporarily unavailable.", { cause })
    this.name = "OidcTemporarilyUnavailableApplicationError"
  }
}

export class OidcInvalidRequestApplicationError extends Error {
  constructor(cause?: unknown) {
    super("The OIDC request is invalid.", { cause })
    this.name = "OidcInvalidRequestApplicationError"
  }
}

export class OidcInvalidScopeApplicationError extends Error {
  constructor(cause?: unknown) {
    super("The requested OIDC scope is invalid.", { cause })
    this.name = "OidcInvalidScopeApplicationError"
  }
}

export class OidcInvalidGrantApplicationError extends Error {
  constructor(cause?: unknown) {
    super("The OIDC authorization grant is invalid.", { cause })
    this.name = "OidcInvalidGrantApplicationError"
  }
}
