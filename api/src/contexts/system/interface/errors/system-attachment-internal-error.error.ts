import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemAttachmentInternalError extends SystemHTTPException {
  constructor(props: { code: string; detail: string; cause?: unknown }) {
    super({ status: 500, ...props })
  }
}
