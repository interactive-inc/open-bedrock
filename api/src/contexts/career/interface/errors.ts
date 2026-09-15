import { HTTPException } from "hono/http-exception"

export class CareerHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class CareerForbiddenError extends CareerHTTPException {
  constructor() {
    super(403, { message: "career permission is required" })
  }
}

export class CareerNotFoundError extends CareerHTTPException {
  constructor() {
    super(404, { message: "career resource is unavailable" })
  }
}

export class CareerUnavailableError extends CareerHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "career service is unavailable" })
  }
}

export class CareerInputError extends CareerHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class CareerConflictError extends CareerHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "career operation changed or conflicted" })
  }
}
