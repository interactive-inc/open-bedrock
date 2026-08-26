import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemIdentityConflictError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "identity_conflict", detail: "identity conflict" })
  }
}
