import { HTTPException } from "hono/http-exception"

export class KnowledgeHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class KnowledgeForbiddenError extends KnowledgeHTTPException {
  constructor() {
    super(403, { message: "knowledge permission is required" })
  }
}

export class KnowledgeNotFoundError extends KnowledgeHTTPException {
  constructor() {
    super(404, { message: "knowledge resource is unavailable" })
  }
}

export class KnowledgeUnavailableError extends KnowledgeHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "knowledge service is unavailable" })
  }
}

export class KnowledgeInputError extends KnowledgeHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class KnowledgeConflictError extends KnowledgeHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "knowledge operation changed or conflicted" })
  }
}
