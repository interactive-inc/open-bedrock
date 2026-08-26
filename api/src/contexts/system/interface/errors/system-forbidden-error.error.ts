import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemForbiddenError extends SystemHTTPException {
  constructor() {
    super({ status: 403, code: "forbidden", detail: "forbidden" })
  }
}
