import { ApplicationInternalError } from "@system/application/errors/application-internal-error.error"

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
