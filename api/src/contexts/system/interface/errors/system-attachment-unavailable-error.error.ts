import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemAttachmentUnavailableError extends SystemHTTPException {
  constructor(props: { code?: string; detail?: string; cause?: unknown } = {}) {
    super({
      status: 503,
      code: props.code ?? "attachment_unavailable",
      detail: props.detail ?? "attachment service unavailable",
      cause: props.cause,
    })
  }
}
