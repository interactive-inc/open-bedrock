import { ApplicationNotFoundError } from "@system/application/errors/application-not-found-error.error"

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
