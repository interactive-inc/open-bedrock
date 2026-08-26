import { ApplicationError } from "@system/application/errors/application-error.error"
import type {
  ApplicationErrorBody,
  ApplicationErrorOptions,
} from "@system/application/errors.shared"

export class ApplicationUnauthorizedError extends ApplicationError {
  constructor(input: ApplicationErrorBody, options?: ApplicationErrorOptions) {
    super(401, input, options)
  }
}
