import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemRoleConflictError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "role_conflict", detail: "role conflict" })
  }
}
