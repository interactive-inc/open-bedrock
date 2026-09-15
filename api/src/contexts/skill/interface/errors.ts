import { HTTPException } from "hono/http-exception"

export class SkillHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class SkillForbiddenError extends SkillHTTPException {
  constructor() {
    super(403, { message: "skill permission is required" })
  }
}

export class SkillNotFoundError extends SkillHTTPException {
  constructor() {
    super(404, { message: "skill resource is unavailable" })
  }
}

export class SkillUnavailableError extends SkillHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "skill service is unavailable" })
  }
}

export class SkillInputError extends SkillHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class SkillConflictError extends SkillHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "skill operation changed or conflicted" })
  }
}
