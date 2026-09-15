import { HTTPException } from "hono/http-exception"

export class HeadcountPlanHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class HeadcountPlanForbiddenError extends HeadcountPlanHTTPException {
  constructor() {
    super(403, { message: "headcount-plan permission is required" })
  }
}

export class HeadcountPlanNotFoundError extends HeadcountPlanHTTPException {
  constructor() {
    super(404, { message: "headcount-plan resource is unavailable" })
  }
}

export class HeadcountPlanUnavailableError extends HeadcountPlanHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "headcount-plan service is unavailable" })
  }
}

export class HeadcountPlanInputError extends HeadcountPlanHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class HeadcountPlanConflictError extends HeadcountPlanHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "headcount-plan operation changed or conflicted" })
  }
}
