import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"
import type { SystemApplicationFailure } from "@system/interface/errors.shared"

export class SystemApplicationError extends SystemHTTPException {
  constructor(error: SystemApplicationFailure) {
    const { error: code, message: detail, ...metadata } = error.body
    super({
      status: error.status,
      code,
      detail,
      metadata,
      cause: error,
    })
  }
}
