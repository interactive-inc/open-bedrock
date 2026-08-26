import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemRoleInUseError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "role_in_use", detail: "role is in use" })
  }
}
