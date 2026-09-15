import { HTTPException } from "hono/http-exception"

export class DisciplinaryActionHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class DisciplinaryActionForbiddenError extends DisciplinaryActionHTTPException {
  constructor() {
    super(403, { message: "disciplinary-action permission is required" })
  }
}

export class DisciplinaryActionNotFoundError extends DisciplinaryActionHTTPException {
  constructor() {
    super(404, { message: "disciplinary-action resource is unavailable" })
  }
}

export class DisciplinaryActionUnavailableError extends DisciplinaryActionHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "disciplinary-action service is unavailable" })
  }
}

export class DisciplinaryActionInputError extends DisciplinaryActionHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class DisciplinaryActionConflictError extends DisciplinaryActionHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "disciplinary-action operation changed or conflicted" })
  }
}
