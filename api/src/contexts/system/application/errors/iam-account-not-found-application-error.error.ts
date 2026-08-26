import { ApplicationNotFoundError } from "@system/application/errors/application-not-found-error.error"

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
