import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemRoleNotFoundError extends SystemHTTPException {
  constructor() {
    super({ status: 404, code: "role_not_found", detail: "role not found" })
  }
}
