import {
  ApplicationBadRequestError,
  ApplicationInternalError,
  ApplicationNotFoundError,
  ApplicationServiceUnavailableError,
  ApplicationUnauthorizedError,
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

export class OidcInvalidTokenApplicationError extends ApplicationUnauthorizedError {
  constructor(cause?: unknown) {
    super(
      { error: "invalid_token", message: "The OIDC access token is invalid." },
      { cause },
    )
  }
}

export class OidcTemporarilyUnavailableApplicationError extends ApplicationServiceUnavailableError {
  constructor(cause?: unknown) {
    super(
      {
        error: "temporarily_unavailable",
        message: "OIDC user information is temporarily unavailable.",
      },
      { cause },
    )
  }
}

export class OidcInvalidRequestApplicationError extends ApplicationBadRequestError {
  constructor(cause?: unknown) {
    super(
      { error: "invalid_request", message: "The OIDC request is invalid." },
      { cause },
    )
  }
}

export class OidcInvalidScopeApplicationError extends ApplicationBadRequestError {
  constructor(cause?: unknown) {
    super(
      { error: "invalid_scope", message: "The requested OIDC scope is invalid." },
      { cause },
    )
  }
}

export class OidcInvalidGrantApplicationError extends ApplicationBadRequestError {
  constructor(cause?: unknown) {
    super(
      { error: "invalid_grant", message: "The OIDC authorization grant is invalid." },
      { cause },
    )
  }
}

export class IamAccountNotFoundApplicationError extends ApplicationNotFoundError {
  constructor(cause?: unknown) {
    super(
      {
        error: "account.not_found",
        message: "対象のアカウントが見つかりません。画面を更新してください。",
        item: null,
      },
      { cause },
    )
  }
}

export class IamRoleNotFoundApplicationError extends ApplicationNotFoundError {
  constructor(cause?: unknown) {
    super(
      {
        error: "iam.role_not_found",
        message: "対象のロールが見つかりません。ロールを選び直してください。",
        item: null,
      },
      { cause },
    )
  }
}

export class IamAssignmentNotFoundApplicationError extends ApplicationNotFoundError {
  constructor(cause?: unknown) {
    super(
      {
        error: "iam.assignment_not_found",
        message: "対象のロール割当が見つかりません。画面を更新してください。",
      },
      { cause },
    )
  }
}

export class InvalidIamAssignmentApplicationError extends ApplicationBadRequestError {
  constructor(
    error: string,
    message: string,
    cause?: unknown,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super({ ...details, error, message, item: null }, { cause })
  }
}
