import { InfrastructureError } from "@/lib/errors/infrastructure-error"

export class NotificationReadWriteError extends InfrastructureError {
  constructor(userId: string, cause: unknown) {
    super(
      "NotificationReadWriteError",
      "notification read records could not be persisted",
      {
        entity: "notification_read",
        operation: "save",
        entityId: userId,
      },
      { cause },
    )
  }
}
