import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemRoleBindingInvalidError extends SystemHTTPException {
  constructor() {
    super({ status: 400, code: "invalid_role_binding", detail: "invalid role binding" })
  }
}
