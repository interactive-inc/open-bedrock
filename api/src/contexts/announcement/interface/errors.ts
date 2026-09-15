import { HTTPException } from "hono/http-exception"

export class AnnouncementHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class AnnouncementForbiddenError extends AnnouncementHTTPException {
  constructor() {
    super(403, { message: "announcement permission is required" })
  }
}

export class AnnouncementNotFoundError extends AnnouncementHTTPException {
  constructor() {
    super(404, { message: "announcement resource is unavailable" })
  }
}

export class AnnouncementUnavailableError extends AnnouncementHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "announcement service is unavailable" })
  }
}

export class AnnouncementInputError extends AnnouncementHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class AnnouncementConflictError extends AnnouncementHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "announcement operation changed or conflicted" })
  }
}
