import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemIAMUnavailableError extends SystemHTTPException {
  constructor() {
    super({ status: 503, code: "iam_unavailable", detail: "IAM service unavailable" })
  }
}
