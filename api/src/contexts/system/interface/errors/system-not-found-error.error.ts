import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemNotFoundError extends SystemHTTPException {
  constructor() {
    super({ status: 404, code: "not_found", detail: "not found" })
  }
}
