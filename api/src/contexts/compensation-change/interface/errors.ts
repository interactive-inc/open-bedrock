import { HTTPException } from "hono/http-exception"

export class CompensationChangeHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class CompensationChangeForbiddenError extends CompensationChangeHTTPException {
  constructor() {
    super(403, { message: "compensation-change permission is required" })
  }
}

export class CompensationChangeNotFoundError extends CompensationChangeHTTPException {
  constructor() {
    super(404, { message: "compensation-change resource is unavailable" })
  }
}

export class CompensationChangeUnavailableError extends CompensationChangeHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "compensation-change service is unavailable" })
  }
}

export class CompensationChangeInputError extends CompensationChangeHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class CompensationChangeConflictError extends CompensationChangeHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "compensation-change operation changed or conflicted" })
  }
}
