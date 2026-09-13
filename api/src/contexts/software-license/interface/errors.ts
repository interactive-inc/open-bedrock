import type { LicenseError } from "@/contexts/software-license/domain/errors"
import { HTTPException } from "hono/http-exception"

/** 台帳の公開HTTP失敗。内部原因を応答本文へ出さない。 */
export class SoftwareLicenseHTTPException extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    options?: Readonly<{ message?: string; cause?: unknown }>,
  ) {
    super(status, options)
  }
}

export class SoftwareLicenseForbiddenError extends SoftwareLicenseHTTPException {
  constructor() {
    super(403, { message: "license permission is required" })
  }
}

export class SoftwareLicenseNotFoundError extends SoftwareLicenseHTTPException {
  constructor() {
    super(404, { message: "license resource is unavailable" })
  }
}

export class SoftwareLicenseUnavailableError extends SoftwareLicenseHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(503, options ?? { message: "license service is unavailable" })
  }
}

export class SoftwareLicenseInputError extends SoftwareLicenseHTTPException {
  constructor(options: Readonly<{ message: string }>) {
    super(400, options)
  }
}

export class SoftwareLicenseOperationError extends SoftwareLicenseHTTPException {
  constructor(error: LicenseError) {
    const statuses = {
      forbidden: 403,
      license_not_found: 404,
      assignment_not_found: 404,
      invalid_license: 400,
      license_conflict: 409,
      license_unavailable: 503,
    } as const
    super(statuses[error.code], { message: error.message, cause: error })
  }
}

/** 確認した台帳・提案・資格が処理中に変わり、同じ判断を確定できない。 */
export class SoftwareLicenseConflictError extends SoftwareLicenseHTTPException {
  constructor(options?: Readonly<{ message?: string; cause?: unknown }>) {
    super(409, options ?? { message: "license operation changed or conflicted" })
  }
}
