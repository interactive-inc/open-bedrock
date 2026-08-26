import { ApplicationError } from "@system/application/errors/application-error.error"
import type {
  ApplicationErrorBody,
  ApplicationErrorOptions,
} from "@system/application/errors.shared"

export class ApplicationTooManyRequestsError extends ApplicationError {
  constructor(input: ApplicationErrorBody, options?: ApplicationErrorOptions) {
    super(429, input, options)
  }
}
