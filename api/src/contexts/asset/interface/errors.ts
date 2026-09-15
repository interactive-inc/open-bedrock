import { HTTPException } from "hono/http-exception"

export class AssetHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class AssetForbiddenError extends AssetHTTPException {
  constructor() {
    super(403, { message: "asset permission is required" })
  }
}

export class AssetNotFoundError extends AssetHTTPException {
  constructor() {
    super(404, { message: "asset resource is unavailable" })
  }
}

export class AssetUnavailableError extends AssetHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "asset service is unavailable" })
  }
}

export class AssetInputError extends AssetHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class AssetConflictError extends AssetHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "asset operation changed or conflicted" })
  }
}
