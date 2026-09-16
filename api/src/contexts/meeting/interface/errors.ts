import { HTTPException } from "hono/http-exception"

export class MeetingHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class MeetingForbiddenError extends MeetingHTTPException {
  constructor() {
    super(403, { message: "meeting permission is required" })
  }
}

export class MeetingNotFoundError extends MeetingHTTPException {
  constructor() {
    super(404, { message: "meeting resource is unavailable" })
  }
}

export class MeetingUnavailableError extends MeetingHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "meeting service is unavailable" })
  }
}

export class MeetingInputError extends MeetingHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class MeetingConflictError extends MeetingHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "meeting operation changed or conflicted" })
  }
}
