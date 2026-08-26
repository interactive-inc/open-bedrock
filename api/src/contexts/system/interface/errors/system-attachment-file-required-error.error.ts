import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemAttachmentFileRequiredError extends SystemHTTPException {
  constructor() {
    super({ status: 400, code: "attachment_file_required", detail: "file field is required" })
  }
}
