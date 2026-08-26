import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemInternalServerError extends SystemHTTPException {
  constructor(cause: unknown) {
    super({
      status: 500,
      code: "internal_server_error",
      detail: "処理に失敗しました。",
      cause,
    })
  }
}
