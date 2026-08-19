import {
  ApplicationBadRequestError,
  ApplicationForbiddenError,
  ApplicationInternalError,
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

export class IamAssignmentForbiddenApplicationError extends ApplicationForbiddenError {
  constructor(error: string, message: string) {
    super({ error, message, item: null })
  }
}

export class IamApplicationError extends ApplicationInternalError {
  constructor(cause?: unknown) {
    super(
      {
        error: "iam.operation_failed",
        message: "アカウントとロールの情報を処理できませんでした。もう一度お試しください。",
      },
      { cause },
    )
  }
}

export class IamIdentityNotFoundApplicationError extends ApplicationNotFoundError {
  constructor(cause?: unknown) {
    super(
      {
        error: "identity.not_found",
        message: "対象のログイン方法が見つかりません。画面を更新してください。",
        item: null,
      },
      { cause },
    )
  }
}

export class InvalidIamIdentityApplicationError extends ApplicationBadRequestError {
  constructor(error: string, message: string, cause?: unknown) {
    super({ error, message, item: null }, { cause })
  }
}
