import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemRoleInvalidError extends SystemHTTPException {
  constructor() {
    super({ status: 400, code: "invalid_role", detail: "invalid role" })
  }
}
