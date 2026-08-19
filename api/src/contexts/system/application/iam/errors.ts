import {
  ApplicationBadRequestError,
  ApplicationNotFoundError,
} from "@/lib/errors/application-error"

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
