import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemNotificationNotFoundError extends SystemHTTPException {
  constructor() {
    super({ status: 404, code: "notification_not_found", detail: "notification not found" })
  }
}
