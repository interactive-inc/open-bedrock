import type { NotificationDeliveryBatchValue } from "@system/domain/values/notifications/notification-delivery-batch.value"
import type { NotificationMessageEntity } from "@system/domain/entities/notification-message.entity"
import { SystemNotificationRepository } from "@system/infrastructure/repositories/notifications/system-notification.repository"

export type SystemNotificationPublication = Readonly<{
  message: NotificationMessageEntity
  deliveries: NotificationDeliveryBatchValue
}>

/** 呼び出し側の業務statementと同じD1 batchに追加するportableなSystem通知操作。 */
export function prepareSystemNotificationPublicationBatch(
  input: Readonly<{
    database: D1Database
    publications: ReadonlyArray<SystemNotificationPublication>
  }>,
): ReadonlyArray<D1PreparedStatement> | Error {
  return new SystemNotificationRepository({
    context: { env: { DB: input.database } },
  }).preparePublishBatch(input.publications)
}
