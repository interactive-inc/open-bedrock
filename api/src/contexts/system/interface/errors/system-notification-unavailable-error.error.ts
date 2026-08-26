import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemNotificationUnavailableError extends SystemHTTPException {
  constructor() {
    super({
      status: 503,
      code: "notification_unavailable",
      detail: "notification service unavailable",
    })
  }
}
