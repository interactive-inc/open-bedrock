import { HTTPException } from "hono/http-exception"

export class CertificateRequestHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class CertificateRequestForbiddenError extends CertificateRequestHTTPException {
  constructor() {
    super(403, { message: "certificate-request permission is required" })
  }
}

export class CertificateRequestNotFoundError extends CertificateRequestHTTPException {
  constructor() {
    super(404, { message: "certificate-request resource is unavailable" })
  }
}

export class CertificateRequestUnavailableError extends CertificateRequestHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "certificate-request service is unavailable" })
  }
}

export class CertificateRequestInputError extends CertificateRequestHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class CertificateRequestConflictError extends CertificateRequestHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "certificate-request operation changed or conflicted" })
  }
}
