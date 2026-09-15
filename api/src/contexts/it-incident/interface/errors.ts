import { HTTPException } from "hono/http-exception"

export class ItIncidentHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class ItIncidentForbiddenError extends ItIncidentHTTPException {
  constructor() {
    super(403, { message: "it-incident permission is required" })
  }
}

export class ItIncidentNotFoundError extends ItIncidentHTTPException {
  constructor() {
    super(404, { message: "it-incident resource is unavailable" })
  }
}

export class ItIncidentUnavailableError extends ItIncidentHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "it-incident service is unavailable" })
  }
}

export class ItIncidentInputError extends ItIncidentHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class ItIncidentConflictError extends ItIncidentHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "it-incident operation changed or conflicted" })
  }
}
