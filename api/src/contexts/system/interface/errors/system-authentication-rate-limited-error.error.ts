import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemAuthenticationRateLimitedError extends SystemHTTPException {
  constructor() {
    super({ status: 429, code: "authentication_rate_limited", detail: "too many requests" })
  }
}
