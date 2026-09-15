import { HTTPException } from "hono/http-exception"

export class ThanksHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class ThanksForbiddenError extends ThanksHTTPException {
  constructor() {
    super(403, { message: "thanks permission is required" })
  }
}

export class ThanksNotFoundError extends ThanksHTTPException {
  constructor() {
    super(404, { message: "thanks resource is unavailable" })
  }
}

export class ThanksUnavailableError extends ThanksHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "thanks service is unavailable" })
  }
}

export class ThanksInputError extends ThanksHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class ThanksConflictError extends ThanksHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "thanks operation changed or conflicted" })
  }
}
