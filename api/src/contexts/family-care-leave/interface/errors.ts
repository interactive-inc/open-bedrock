import { HTTPException } from "hono/http-exception"

export class FamilyCareLeaveHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class FamilyCareLeaveForbiddenError extends FamilyCareLeaveHTTPException {
  constructor() {
    super(403, { message: "family-care-leave permission is required" })
  }
}

export class FamilyCareLeaveNotFoundError extends FamilyCareLeaveHTTPException {
  constructor() {
    super(404, { message: "family-care-leave resource is unavailable" })
  }
}

export class FamilyCareLeaveUnavailableError extends FamilyCareLeaveHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "family-care-leave service is unavailable" })
  }
}

export class FamilyCareLeaveInputError extends FamilyCareLeaveHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class FamilyCareLeaveConflictError extends FamilyCareLeaveHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "family-care-leave operation changed or conflicted" })
  }
}
