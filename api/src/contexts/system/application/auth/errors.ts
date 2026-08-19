import {
  ApplicationBadRequestError,
  ApplicationInternalError,
} from "@/lib/errors/application-error"

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
