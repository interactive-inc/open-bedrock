import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemManagedRoleImmutableError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "managed_role", detail: "managed role is immutable" })
  }
}
