import { ApplicationBadRequestError } from "@system/application/errors/application-bad-request-error.error"

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
