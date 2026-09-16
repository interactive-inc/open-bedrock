import { HTTPException } from "hono/http-exception"

export class RoomHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class RoomForbiddenError extends RoomHTTPException {
  constructor() {
    super(403, { message: "room permission is required" })
  }
}

export class RoomNotFoundError extends RoomHTTPException {
  constructor() {
    super(404, { message: "room resource is unavailable" })
  }
}

export class RoomUnavailableError extends RoomHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "room service is unavailable" })
  }
}

export class RoomInputError extends RoomHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class RoomConflictError extends RoomHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "room operation changed or conflicted" })
  }
}
