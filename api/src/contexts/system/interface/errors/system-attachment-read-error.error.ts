import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemAttachmentReadError extends SystemHTTPException {
  constructor(props: { code: string; detail: string; unavailable?: boolean; cause?: unknown }) {
    super({ status: props.unavailable === true ? 503 : 404, ...props })
  }
}
