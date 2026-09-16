import { HTTPException } from "hono/http-exception"

export class ShiftHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class ShiftForbiddenError extends ShiftHTTPException {
  constructor() {
    super(403, { message: "shift permission is required" })
  }
}

export class ShiftNotFoundError extends ShiftHTTPException {
  constructor() {
    super(404, { message: "shift resource is unavailable" })
  }
}

export class ShiftUnavailableError extends ShiftHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "shift service is unavailable" })
  }
}

export class ShiftInputError extends ShiftHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class ShiftConflictError extends ShiftHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "shift operation changed or conflicted" })
  }
}
