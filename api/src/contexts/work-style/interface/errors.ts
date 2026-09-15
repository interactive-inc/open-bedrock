import { HTTPException } from "hono/http-exception"

export class EmployeeWorkStyleHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class EmployeeWorkStyleForbiddenError extends EmployeeWorkStyleHTTPException {
  constructor() {
    super(403, { message: "work-style permission is required" })
  }
}

export class EmployeeWorkStyleNotFoundError extends EmployeeWorkStyleHTTPException {
  constructor() {
    super(404, { message: "work-style resource is unavailable" })
  }
}

export class EmployeeWorkStyleUnavailableError extends EmployeeWorkStyleHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "work-style service is unavailable" })
  }
}

export class EmployeeWorkStyleInputError extends EmployeeWorkStyleHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class EmployeeWorkStyleConflictError extends EmployeeWorkStyleHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "work-style operation changed or conflicted" })
  }
}
