import { HTTPException } from "hono/http-exception"

export class RegulationHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class RegulationForbiddenError extends RegulationHTTPException {
  constructor() {
    super(403, { message: "regulation permission is required" })
  }
}

export class RegulationNotFoundError extends RegulationHTTPException {
  constructor() {
    super(404, { message: "regulation resource is unavailable" })
  }
}

export class RegulationUnavailableError extends RegulationHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "regulation service is unavailable" })
  }
}

export class RegulationInputError extends RegulationHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class RegulationConflictError extends RegulationHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "regulation operation changed or conflicted" })
  }
}
