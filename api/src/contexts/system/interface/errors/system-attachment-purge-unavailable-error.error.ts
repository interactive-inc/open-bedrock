import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemAttachmentPurgeUnavailableError extends SystemHTTPException {
  constructor(cause?: unknown) {
    super({
      status: 503,
      code: "attachment_purge_unavailable",
      detail: "attachment purge unavailable",
      cause,
    })
  }
}
