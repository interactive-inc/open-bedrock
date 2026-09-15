import { HTTPException } from "hono/http-exception"

export class HealthCheckupHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class HealthCheckupForbiddenError extends HealthCheckupHTTPException {
  constructor() {
    super(403, { message: "health-checkup permission is required" })
  }
}

export class HealthCheckupNotFoundError extends HealthCheckupHTTPException {
  constructor() {
    super(404, { message: "health-checkup resource is unavailable" })
  }
}

export class HealthCheckupUnavailableError extends HealthCheckupHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "health-checkup service is unavailable" })
  }
}

export class HealthCheckupInputError extends HealthCheckupHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class HealthCheckupConflictError extends HealthCheckupHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "health-checkup operation changed or conflicted" })
  }
}
