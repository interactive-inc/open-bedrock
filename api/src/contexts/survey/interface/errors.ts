import { HTTPException } from "hono/http-exception"

export class SurveyHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class SurveyForbiddenError extends SurveyHTTPException {
  constructor() {
    super(403, { message: "survey permission is required" })
  }
}

export class SurveyNotFoundError extends SurveyHTTPException {
  constructor() {
    super(404, { message: "survey resource is unavailable" })
  }
}

export class SurveyUnavailableError extends SurveyHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "survey service is unavailable" })
  }
}

export class SurveyInputError extends SurveyHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class SurveyConflictError extends SurveyHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "survey operation changed or conflicted" })
  }
}
