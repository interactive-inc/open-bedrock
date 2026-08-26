import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemPasswordCredentialNotFoundError extends SystemHTTPException {
  constructor() {
    super({
      status: 404,
      code: "password_credential_not_found",
      detail: "password credential not found",
    })
  }
}
