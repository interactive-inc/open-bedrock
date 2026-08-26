import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemAuthenticationRequiredError extends SystemHTTPException {
  constructor() {
    super({
      status: 401,
      code: "authentication_required",
      detail: "authentication required",
    })
  }
}
