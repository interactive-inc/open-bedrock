import { ApplicationInternalError } from "@system/application/errors/application-internal-error.error"

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
