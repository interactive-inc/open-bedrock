import { ApplicationError } from "@system/application/errors/application-error.error"
import type {
  ApplicationErrorBody,
  ApplicationErrorOptions,
} from "@system/application/errors.shared"

export class ApplicationNotFoundError extends ApplicationError {
  constructor(
    input: ApplicationErrorBody = {
      error: "not_found",
      message: "対象のデータが見つかりません。削除または更新された可能性があります。",
    },
    options?: ApplicationErrorOptions,
  ) {
    super(404, input, options)
  }
}
