import { HTTPException } from "hono/http-exception"

export class ResignationHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class ResignationForbiddenError extends ResignationHTTPException {
  constructor() {
    super(403, { message: "resignation permission is required" })
  }
}

export class ResignationNotFoundError extends ResignationHTTPException {
  constructor() {
    super(404, { message: "resignation resource is unavailable" })
  }
}

export class ResignationUnavailableError extends ResignationHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "resignation service is unavailable" })
  }
}

export class ResignationInputError extends ResignationHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class ResignationConflictError extends ResignationHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "resignation operation changed or conflicted" })
  }
}
