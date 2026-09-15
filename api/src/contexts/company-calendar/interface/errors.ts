import { HTTPException } from "hono/http-exception"

export class CompanyCalendarDayHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class CompanyCalendarDayForbiddenError extends CompanyCalendarDayHTTPException {
  constructor() {
    super(403, { message: "company-calendar permission is required" })
  }
}

export class CompanyCalendarDayNotFoundError extends CompanyCalendarDayHTTPException {
  constructor() {
    super(404, { message: "company-calendar resource is unavailable" })
  }
}

export class CompanyCalendarDayUnavailableError extends CompanyCalendarDayHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "company-calendar service is unavailable" })
  }
}

export class CompanyCalendarDayInputError extends CompanyCalendarDayHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class CompanyCalendarDayConflictError extends CompanyCalendarDayHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "company-calendar operation changed or conflicted" })
  }
}
