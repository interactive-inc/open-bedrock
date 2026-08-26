import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemSessionUnavailableError extends SystemHTTPException {
  constructor(cause?: unknown) {
    super({
      status: 503,
      code: "session_unavailable",
      detail: "session service unavailable",
      ...(cause === undefined ? {} : { cause }),
    })
  }
}
