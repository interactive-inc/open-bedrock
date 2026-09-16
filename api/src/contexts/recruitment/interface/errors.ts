import { HTTPException } from "hono/http-exception"

export class RecruitmentHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class RecruitmentForbiddenError extends RecruitmentHTTPException {
  constructor() {
    super(403, { message: "recruitment permission is required" })
  }
}

export class RecruitmentNotFoundError extends RecruitmentHTTPException {
  constructor() {
    super(404, { message: "recruitment resource is unavailable" })
  }
}

export class RecruitmentUnavailableError extends RecruitmentHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "recruitment service is unavailable" })
  }
}

export class RecruitmentInputError extends RecruitmentHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class RecruitmentConflictError extends RecruitmentHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "recruitment operation changed or conflicted" })
  }
}
