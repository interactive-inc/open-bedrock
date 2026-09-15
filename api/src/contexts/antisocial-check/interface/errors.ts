import { HTTPException } from "hono/http-exception"

export class AntisocialCheckHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class AntisocialCheckForbiddenError extends AntisocialCheckHTTPException {
  constructor() {
    super(403, { message: "antisocial-check permission is required" })
  }
}

export class AntisocialCheckNotFoundError extends AntisocialCheckHTTPException {
  constructor() {
    super(404, { message: "antisocial-check resource is unavailable" })
  }
}

export class AntisocialCheckUnavailableError extends AntisocialCheckHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "antisocial-check service is unavailable" })
  }
}

export class AntisocialCheckInputError extends AntisocialCheckHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class AntisocialCheckConflictError extends AntisocialCheckHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "antisocial-check operation changed or conflicted" })
  }
}
