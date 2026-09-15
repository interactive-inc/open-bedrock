import { HTTPException } from "hono/http-exception"

export class CommendationHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class CommendationForbiddenError extends CommendationHTTPException {
  constructor() {
    super(403, { message: "commendation permission is required" })
  }
}

export class CommendationNotFoundError extends CommendationHTTPException {
  constructor() {
    super(404, { message: "commendation resource is unavailable" })
  }
}

export class CommendationUnavailableError extends CommendationHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "commendation service is unavailable" })
  }
}

export class CommendationInputError extends CommendationHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class CommendationConflictError extends CommendationHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "commendation operation changed or conflicted" })
  }
}
