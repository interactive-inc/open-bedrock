import { ApplicationNotFoundError } from "@system/application/errors/application-not-found-error.error"

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
