import { HTTPException } from "hono/http-exception"

export class PerformanceReviewHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class PerformanceReviewForbiddenError extends PerformanceReviewHTTPException {
  constructor() {
    super(403, { message: "performanceReview permission is required" })
  }
}

export class PerformanceReviewNotFoundError extends PerformanceReviewHTTPException {
  constructor() {
    super(404, { message: "performanceReview resource is unavailable" })
  }
}

export class PerformanceReviewUnavailableError extends PerformanceReviewHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "performanceReview service is unavailable" })
  }
}

export class PerformanceReviewInputError extends PerformanceReviewHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class PerformanceReviewConflictError extends PerformanceReviewHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "performanceReview operation changed or conflicted" })
  }
}
