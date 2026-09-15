import { HTTPException } from "hono/http-exception"

export class TrainingHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class TrainingForbiddenError extends TrainingHTTPException {
  constructor() {
    super(403, { message: "training permission is required" })
  }
}

export class TrainingNotFoundError extends TrainingHTTPException {
  constructor() {
    super(404, { message: "training resource is unavailable" })
  }
}

export class TrainingUnavailableError extends TrainingHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "training service is unavailable" })
  }
}

export class TrainingInputError extends TrainingHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class TrainingConflictError extends TrainingHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "training operation changed or conflicted" })
  }
}
