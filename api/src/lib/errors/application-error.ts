export type ApplicationErrorBody = Readonly<
  { error: string; message: string } & Record<string, unknown>
>
type ApplicationErrorInput = ApplicationErrorBody
type ApplicationErrorStatus =
  | 400
  | 401
  | 403
  | 404
  | 409
  | 413
  | 415
  | 422
  | 423
  | 429
  | 500
  | 502
  | 503
type ApplicationErrorOptions = Readonly<{ cause?: unknown }>

export class ApplicationError extends Error {
  readonly layer = "application"
  readonly status: ApplicationErrorStatus
  readonly body: ApplicationErrorBody

  constructor(
    status: ApplicationErrorStatus,
    body: ApplicationErrorInput,
    options: ApplicationErrorOptions = {},
  ) {
    super(body.message, { cause: options.cause })
    this.name = new.target.name
    this.status = status
    this.body = body
  }
}

export class ApplicationBadRequestError extends ApplicationError {
  constructor(input: ApplicationErrorInput, options?: ApplicationErrorOptions) {
    super(400, input, options)
  }
}

export class ApplicationUnauthorizedError extends ApplicationError {
  constructor(input: ApplicationErrorInput, options?: ApplicationErrorOptions) {
    super(401, input, options)
  }
}

export class ApplicationForbiddenError extends ApplicationError {
  constructor(
    input: ApplicationErrorInput = {
      error: "forbidden",
      message: "この操作を行う権限がありません。",
    },
    options?: ApplicationErrorOptions,
  ) {
    super(403, input, options)
  }
}

export class ApplicationNotFoundError extends ApplicationError {
  constructor(
    input: ApplicationErrorInput = {
      error: "not_found",
      message: "対象のデータが見つかりません。削除または更新された可能性があります。",
    },
    options?: ApplicationErrorOptions,
  ) {
    super(404, input, options)
  }
}

export class ApplicationConflictError extends ApplicationError {
  constructor(input: ApplicationErrorInput, options?: ApplicationErrorOptions) {
    super(409, input, options)
  }
}

export class ApplicationPayloadTooLargeError extends ApplicationError {
  constructor(input: ApplicationErrorInput, options?: ApplicationErrorOptions) {
    super(413, input, options)
  }
}

export class ApplicationUnsupportedMediaTypeError extends ApplicationError {
  constructor(input: ApplicationErrorInput, options?: ApplicationErrorOptions) {
    super(415, input, options)
  }
}

export class ApplicationUnprocessableEntityError extends ApplicationError {
  constructor(input: ApplicationErrorInput, options?: ApplicationErrorOptions) {
    super(422, input, options)
  }
}

export class ApplicationLockedError extends ApplicationError {
  constructor(input: ApplicationErrorInput, options?: ApplicationErrorOptions) {
    super(423, input, options)
  }
}

export class ApplicationTooManyRequestsError extends ApplicationError {
  constructor(input: ApplicationErrorInput, options?: ApplicationErrorOptions) {
    super(429, input, options)
  }
}

export class ApplicationInternalError extends ApplicationError {
  constructor(input: ApplicationErrorInput, options?: ApplicationErrorOptions) {
    super(500, input, options)
  }
}

export class ApplicationBadGatewayError extends ApplicationError {
  constructor(input: ApplicationErrorInput, options?: ApplicationErrorOptions) {
    super(502, input, options)
  }
}

export class ApplicationServiceUnavailableError extends ApplicationError {
  constructor(input: ApplicationErrorInput, options?: ApplicationErrorOptions) {
    super(503, input, options)
  }
}
