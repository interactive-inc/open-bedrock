import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemRoleBindingConflictError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "role_binding_conflict", detail: "role binding conflict" })
  }
}
