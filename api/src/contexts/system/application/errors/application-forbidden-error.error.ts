import { ApplicationError } from "@system/application/errors/application-error.error"
import type {
  ApplicationErrorBody,
  ApplicationErrorOptions,
} from "@system/application/errors.shared"

export class ApplicationForbiddenError extends ApplicationError {
  constructor(
    input: ApplicationErrorBody = {
      error: "forbidden",
      message: "この操作を行う権限がありません。",
    },
    options?: ApplicationErrorOptions,
  ) {
    super(403, input, options)
  }
}
