import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemRoleBindingNotFoundError extends SystemHTTPException {
  constructor() {
    super({ status: 404, code: "role_binding_not_found", detail: "role binding not found" })
  }
}
