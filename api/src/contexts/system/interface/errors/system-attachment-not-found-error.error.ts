import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemAttachmentNotFoundError extends SystemHTTPException {
  constructor() {
    super({ status: 404, code: "attachment_not_found", detail: "attachment not found" })
  }
}
