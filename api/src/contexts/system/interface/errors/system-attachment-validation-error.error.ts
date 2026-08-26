import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemAttachmentValidationError extends SystemHTTPException {
  constructor(props: { code: string; detail: string; payloadTooLarge?: boolean; cause?: unknown }) {
    super({
      status: props.payloadTooLarge === true ? 413 : 400,
      code: props.code,
      detail: props.detail,
      cause: props.cause,
    })
  }
}
