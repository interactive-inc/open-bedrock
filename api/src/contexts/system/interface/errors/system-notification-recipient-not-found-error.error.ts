import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemNotificationRecipientNotFoundError extends SystemHTTPException {
  constructor() {
    super({
      status: 404,
      code: "notification_recipient_not_found",
      detail: "notification recipient not found",
    })
  }
}
