import { HTTPException } from "hono/http-exception"

export class DocumentHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class DocumentForbiddenError extends DocumentHTTPException {
  constructor() {
    super(403, { message: "document permission is required" })
  }
}

export class DocumentNotFoundError extends DocumentHTTPException {
  constructor() {
    super(404, { message: "document resource is unavailable" })
  }
}

export class DocumentUnavailableError extends DocumentHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "document service is unavailable" })
  }
}

export class DocumentInputError extends DocumentHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class DocumentConflictError extends DocumentHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "document operation changed or conflicted" })
  }
}
