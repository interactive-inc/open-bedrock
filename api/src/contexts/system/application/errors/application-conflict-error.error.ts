import { ApplicationError } from "@system/application/errors/application-error.error"
import type {
  ApplicationErrorBody,
  ApplicationErrorOptions,
} from "@system/application/errors.shared"

export class ApplicationConflictError extends ApplicationError {
  constructor(input: ApplicationErrorBody, options?: ApplicationErrorOptions) {
    super(409, input, options)
  }
}
