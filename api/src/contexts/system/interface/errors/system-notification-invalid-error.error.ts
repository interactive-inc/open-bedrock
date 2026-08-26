import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemNotificationInvalidError extends SystemHTTPException {
  constructor() {
    super({ status: 400, code: "invalid_notification", detail: "invalid notification" })
  }
}
