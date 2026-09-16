import { HTTPException } from "hono/http-exception"

export class RingiHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class RingiForbiddenError extends RingiHTTPException {
  constructor() {
    super(403, { message: "ringi permission is required" })
  }
}

export class RingiNotFoundError extends RingiHTTPException {
  constructor() {
    super(404, { message: "ringi resource is unavailable" })
  }
}

export class RingiUnavailableError extends RingiHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "ringi service is unavailable" })
  }
}

export class RingiInputError extends RingiHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class RingiConflictError extends RingiHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "ringi operation changed or conflicted" })
  }
}
