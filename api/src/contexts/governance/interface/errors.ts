import { HTTPException } from "hono/http-exception"

export class GovernanceHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class GovernanceForbiddenError extends GovernanceHTTPException {
  constructor() {
    super(403, { message: "governance permission is required" })
  }
}

export class GovernanceNotFoundError extends GovernanceHTTPException {
  constructor() {
    super(404, { message: "governance resource is unavailable" })
  }
}

export class GovernanceUnavailableError extends GovernanceHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "governance service is unavailable" })
  }
}

export class GovernanceInputError extends GovernanceHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class GovernanceConflictError extends GovernanceHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "governance operation changed or conflicted" })
  }
}
