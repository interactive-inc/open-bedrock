import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemAttachmentNotPendingError extends SystemHTTPException {
  constructor() {
    super({
      status: 404,
      code: "attachment_not_pending",
      detail: "attachment is linked to a record",
    })
  }
}
