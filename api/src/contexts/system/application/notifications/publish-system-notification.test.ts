import type { NotificationRepository } from "@system/application/notifications/notification-repository"
import { PublishSystemNotification } from "@system/application/notifications/publish-system-notification"
import { NotificationDeliveryBatch } from "@system/domain/notifications/notification-delivery-batch"
import { NotificationDelivery } from "@system/domain/notifications/notification-delivery.entity"
import { NotificationMessage } from "@system/domain/notifications/notification-message.entity"
import { describe, expect, test } from "bun:test"

const unreachableRepository: NotificationRepository = {
  publish: () => Promise.reject(new Error("repository must not be called")),
  findDeliveryByIdForAccount: () => Promise.reject(new Error("repository must not be called")),
  findByDeliveryIdForAccount: () => Promise.reject(new Error("repository must not be called")),
  listForAccount: () => Promise.reject(new Error("repository must not be called")),
  countUnreadForAccount: () => Promise.reject(new Error("repository must not be called")),
  markDeliveryRead: () => Promise.reject(new Error("repository must not be called")),
  markAllDeliveriesRead: () => Promise.reject(new Error("repository must not be called")),
  dismissDelivery: () => Promise.reject(new Error("repository must not be called")),
}

describe("PublishSystemNotification", () => {
  test("空配信を拒否する", async () => {
    const publish = new PublishSystemNotification({
      notificationRepository: unreachableRepository,
    })

    expect(
      await publish.execute({ message: createMessage("message-1"), deliveries: createBatch([]) }),
    ).toEqual({ kind: "rejected", reason: "empty_deliveries" })
  })

  test.each([
    {
      reason: "message_mismatch" as const,
      delivery: () => createDelivery("delivery-1", "message-other", new Date(2_000), null),
    },
    {
      reason: "delivery_before_message" as const,
      delivery: () => createDelivery("delivery-1", "message-1", new Date(999), null),
    },
    {
      reason: "already_read" as const,
      delivery: () => createDelivery("delivery-1", "message-1", new Date(2_000), new Date(3_000)),
    },
  ])("$reason を永続化前に拒否する", async ({ reason, delivery }) => {
    const publish = new PublishSystemNotification({
      notificationRepository: unreachableRepository,
    })

    expect(
      await publish.execute({
        message: createMessage("message-1"),
        deliveries: createBatch([delivery()]),
      }),
    ).toEqual({ kind: "rejected", reason })
  })
})

function createMessage(id: string): NotificationMessage {
  const message = NotificationMessage.create({
    id,
    kind: "system:test.created",
    title: "notification",
    body: null,
    source: null,
    createdAt: new Date(1_000),
  })
  if (message instanceof Error) throw message

  return message
}

function createDelivery(
  id: string,
  messageId: string,
  deliveredAt: Date,
  readAt: Date | null,
): NotificationDelivery {
  const delivery = NotificationDelivery.create({
    id,
    messageId,
    recipientAccountId: "account-1",
    deliveredAt,
    readAt,
  })
  if (delivery instanceof Error) throw delivery

  return delivery
}

function createBatch(deliveries: Array<NotificationDelivery>): NotificationDeliveryBatch {
  const batch = NotificationDeliveryBatch.create(deliveries)
  if (batch instanceof Error) throw batch

  return batch
}
