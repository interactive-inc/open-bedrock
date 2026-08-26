import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemNotificationTransitionInvalidError extends SystemHTTPException {
  constructor() {
    super({
      status: 409,
      code: "invalid_notification_transition",
      detail: "invalid notification transition",
    })
  }
}
