import { HTTPException } from "hono/http-exception"

export class CertificationHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class CertificationForbiddenError extends CertificationHTTPException {
  constructor() {
    super(403, { message: "certification permission is required" })
  }
}

export class CertificationNotFoundError extends CertificationHTTPException {
  constructor() {
    super(404, { message: "certification resource is unavailable" })
  }
}

export class CertificationUnavailableError extends CertificationHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "certification service is unavailable" })
  }
}

export class CertificationInputError extends CertificationHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class CertificationConflictError extends CertificationHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "certification operation changed or conflicted" })
  }
}
