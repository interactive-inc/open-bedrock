import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemAlreadyInitializedError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "already_initialized", detail: "already initialized" })
  }
}
