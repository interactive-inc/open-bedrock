import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemBootstrapUnavailableError extends SystemHTTPException {
  constructor() {
    super({ status: 503, code: "bootstrap_unavailable", detail: "bootstrap service unavailable" })
  }
}
