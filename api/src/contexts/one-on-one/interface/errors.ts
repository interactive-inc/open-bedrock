import { HTTPException } from "hono/http-exception"

export class OneOnOneHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class OneOnOneForbiddenError extends OneOnOneHTTPException {
  constructor() {
    super(403, { message: "one-on-one permission is required" })
  }
}

export class OneOnOneNotFoundError extends OneOnOneHTTPException {
  constructor() {
    super(404, { message: "one-on-one resource is unavailable" })
  }
}

export class OneOnOneUnavailableError extends OneOnOneHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "one-on-one service is unavailable" })
  }
}

export class OneOnOneInputError extends OneOnOneHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class OneOnOneConflictError extends OneOnOneHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "one-on-one operation changed or conflicted" })
  }
}
