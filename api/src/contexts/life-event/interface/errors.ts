import { HTTPException } from "hono/http-exception"

export class LifeEventHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class LifeEventForbiddenError extends LifeEventHTTPException {
  constructor() {
    super(403, { message: "life-event permission is required" })
  }
}

export class LifeEventNotFoundError extends LifeEventHTTPException {
  constructor() {
    super(404, { message: "life-event resource is unavailable" })
  }
}

export class LifeEventUnavailableError extends LifeEventHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "life-event service is unavailable" })
  }
}

export class LifeEventInputError extends LifeEventHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class LifeEventConflictError extends LifeEventHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "life-event operation changed or conflicted" })
  }
}
