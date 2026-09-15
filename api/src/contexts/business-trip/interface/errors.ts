import { HTTPException } from "hono/http-exception"

export class BusinessTripHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class BusinessTripForbiddenError extends BusinessTripHTTPException {
  constructor() {
    super(403, { message: "business-trip permission is required" })
  }
}

export class BusinessTripNotFoundError extends BusinessTripHTTPException {
  constructor() {
    super(404, { message: "business-trip resource is unavailable" })
  }
}

export class BusinessTripUnavailableError extends BusinessTripHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "business-trip service is unavailable" })
  }
}

export class BusinessTripInputError extends BusinessTripHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class BusinessTripConflictError extends BusinessTripHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "business-trip operation changed or conflicted" })
  }
}
