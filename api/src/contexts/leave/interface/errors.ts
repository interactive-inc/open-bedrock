import { HTTPException } from "hono/http-exception"

export class LeaveHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class LeaveForbiddenError extends LeaveHTTPException {
  constructor() {
    super(403, { message: "leave permission is required" })
  }
}

export class LeaveNotFoundError extends LeaveHTTPException {
  constructor() {
    super(404, { message: "leave resource is unavailable" })
  }
}

export class LeaveUnavailableError extends LeaveHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "leave service is unavailable" })
  }
}

export class LeaveInputError extends LeaveHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class LeaveConflictError extends LeaveHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "leave operation changed or conflicted" })
  }
}
