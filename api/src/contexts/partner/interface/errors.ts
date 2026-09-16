import { HTTPException } from "hono/http-exception"

export class PartnerHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class PartnerForbiddenError extends PartnerHTTPException {
  constructor() {
    super(403, { message: "partner permission is required" })
  }
}

export class PartnerNotFoundError extends PartnerHTTPException {
  constructor() {
    super(404, { message: "partner resource is unavailable" })
  }
}

export class PartnerUnavailableError extends PartnerHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "partner service is unavailable" })
  }
}

export class PartnerInputError extends PartnerHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class PartnerConflictError extends PartnerHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "partner operation changed or conflicted" })
  }
}
