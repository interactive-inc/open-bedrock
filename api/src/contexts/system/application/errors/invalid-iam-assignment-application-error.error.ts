import { ApplicationBadRequestError } from "@system/application/errors/application-bad-request-error.error"

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
