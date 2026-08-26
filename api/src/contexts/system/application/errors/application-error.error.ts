import type {
  ApplicationErrorBody,
  ApplicationErrorOptions,
  ApplicationErrorStatus,
} from "@system/application/errors.shared"

export class ApplicationError extends Error {
  readonly layer = "application"
  readonly status: ApplicationErrorStatus
  readonly body: ApplicationErrorBody

  constructor(
    status: ApplicationErrorStatus,
    body: ApplicationErrorBody,
    options: ApplicationErrorOptions = {},
  ) {
    super(body.message, { cause: options.cause })
    this.name = new.target.name
    this.status = status
    this.body = body
  }
}
