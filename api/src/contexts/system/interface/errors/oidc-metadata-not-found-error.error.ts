import { OIDCHTTPException } from "@system/interface/errors/oidchttp-exception.error"

export class OIDCMetadataNotFoundError extends OIDCHTTPException {
  constructor(cause?: unknown) {
    super({ code: "not_found", status: 404, cause })
  }
}
