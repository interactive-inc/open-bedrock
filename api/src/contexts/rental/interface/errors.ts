import { HTTPException } from "hono/http-exception"

export class RentalReservationHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class RentalReservationForbiddenError extends RentalReservationHTTPException {
  constructor() {
    super(403, { message: "rental permission is required" })
  }
}

export class RentalReservationNotFoundError extends RentalReservationHTTPException {
  constructor() {
    super(404, { message: "rental resource is unavailable" })
  }
}

export class RentalReservationUnavailableError extends RentalReservationHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "rental service is unavailable" })
  }
}

export class RentalReservationInputError extends RentalReservationHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class RentalReservationConflictError extends RentalReservationHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "rental operation changed or conflicted" })
  }
}
