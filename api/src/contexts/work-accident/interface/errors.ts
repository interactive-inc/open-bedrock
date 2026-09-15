import { HTTPException } from "hono/http-exception"

export class WorkAccidentHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class WorkAccidentForbiddenError extends WorkAccidentHTTPException {
  constructor() {
    super(403, { message: "work-accident permission is required" })
  }
}

export class WorkAccidentNotFoundError extends WorkAccidentHTTPException {
  constructor() {
    super(404, { message: "work-accident resource is unavailable" })
  }
}

export class WorkAccidentUnavailableError extends WorkAccidentHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "work-accident service is unavailable" })
  }
}

export class WorkAccidentInputError extends WorkAccidentHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class WorkAccidentConflictError extends WorkAccidentHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "work-accident operation changed or conflicted" })
  }
}
