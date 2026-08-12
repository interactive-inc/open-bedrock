import { InvalidNotificationDeliveryBatchError } from "@system/domain/notifications/invalid-notification-delivery-batch.error"
import { NotificationDeliveryBatch } from "@system/domain/notifications/notification-delivery-batch"
import { NotificationDelivery } from "@system/domain/notifications/notification-delivery.entity"
import { describe, expect, test } from "bun:test"

function createDelivery(id: string, messageId: string, accountId: string): NotificationDelivery {
  const delivery = NotificationDelivery.create({
    id,
    messageId,
    recipientAccountId: accountId,
    deliveredAt: new Date("2026-08-11T00:00:00.000Z"),
    readAt: null,
  })

  if (!(delivery instanceof NotificationDelivery)) throw delivery

  return delivery
}

describe("NotificationDeliveryBatch", () => {
  test("broadcastをconcreteなAccount deliveryのimmutable fan-outとして表す", () => {
    const first = createDelivery("delivery-1", "message-1", "account-1")
    const second = createDelivery("delivery-2", "message-1", "account-2")
    const input = [first, second]
    const batch = NotificationDeliveryBatch.create(input)

    expect(batch).toBeInstanceOf(NotificationDeliveryBatch)
    if (!(batch instanceof NotificationDeliveryBatch)) return

    expect(batch.deliveries).toEqual([first, second])
    expect(Object.isFrozen(batch)).toBe(true)
    expect(Object.isFrozen(batch.deliveries)).toBe(true)

    input.pop()
    expect(batch.deliveries).toEqual([first, second])
  })

  test("同じAccountでも別message、同じmessageでも別Accountなら共存できる", () => {
    const batch = NotificationDeliveryBatch.create([
      createDelivery("delivery-1", "message-1", "account-1"),
      createDelivery("delivery-2", "message-1", "account-2"),
      createDelivery("delivery-3", "message-2", "account-1"),
    ])

    expect(batch).toBeInstanceOf(NotificationDeliveryBatch)
  })

  test("空fan-outを安全なno-opとして表せる", () => {
    const batch = NotificationDeliveryBatch.create([])

    expect(batch).toBeInstanceOf(NotificationDeliveryBatch)
    if (batch instanceof NotificationDeliveryBatch) {
      expect(batch.deliveries).toEqual([])
    }
  })

  test("重複delivery IDを拒否する", () => {
    const result = NotificationDeliveryBatch.create([
      createDelivery("delivery-1", "message-1", "account-1"),
      createDelivery("delivery-1", "message-1", "account-2"),
    ])

    expect(result).toBeInstanceOf(InvalidNotificationDeliveryBatchError)
    if (result instanceof InvalidNotificationDeliveryBatchError) {
      expect(result.reason).toBe("duplicate_delivery_id")
    }
  })

  test("同じMessage/Accountへの重複配信をIDが違っても拒否する", () => {
    const result = NotificationDeliveryBatch.create([
      createDelivery("delivery-1", "message-1", "account-1"),
      createDelivery("delivery-2", "message-1", "account-1"),
    ])

    expect(result).toBeInstanceOf(InvalidNotificationDeliveryBatchError)
    if (result instanceof InvalidNotificationDeliveryBatchError) {
      expect(result.reason).toBe("duplicate_message_recipient")
    }
  })

  test.each([[null], [{}], [[{ recipientAccountId: null }]]])(
    "entity以外のbatch inputをfail closedで拒否する: %p",
    (input) => {
      const result = NotificationDeliveryBatch.create(input)

      expect(result).toBeInstanceOf(InvalidNotificationDeliveryBatchError)
      if (result instanceof InvalidNotificationDeliveryBatchError) {
        expect(result.reason).toBe("invalid_shape")
      }
    },
  )
})
