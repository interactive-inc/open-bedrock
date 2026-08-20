import { InvalidNotificationDeliveryError } from "@system/domain/notifications/invalid-notification-delivery.error"
import { NotificationDelivery } from "@system/domain/notifications/notification-delivery.entity"
import { describe, expect, test } from "bun:test"

const validProps = {
  id: "delivery-1",
  messageId: "message-1",
  recipientAccountId: "account-1",
  deliveredAt: new Date("2026-08-11T00:00:00.000Z"),
  readAt: null,
} as const

describe("NotificationDelivery", () => {
  test("nullable recipientを使わずconcreteなAccount deliveryを作る", () => {
    const deliveredAt = new Date(validProps.deliveredAt)
    const delivery = NotificationDelivery.create({ ...validProps, deliveredAt })

    expect(delivery).toBeInstanceOf(NotificationDelivery)
    if (!(delivery instanceof NotificationDelivery)) return

    expect(delivery).toMatchObject({
      id: "delivery-1",
      messageId: "message-1",
      recipientAccountId: "account-1",
      isRead: false,
    })
    expect(delivery.readAt).toBeNull()
    expect(Object.isFrozen(delivery)).toBe(true)

    deliveredAt.setUTCFullYear(2030)
    expect(delivery.deliveredAt).toEqual(validProps.deliveredAt)

    const exposedDate = delivery.deliveredAt
    exposedDate.setUTCFullYear(2031)
    expect(delivery.deliveredAt).toEqual(validProps.deliveredAt)
  })

  test("既読化は単調かつ冪等で、元のdeliveryを変更しない", () => {
    const delivery = NotificationDelivery.create(validProps)
    expect(delivery).toBeInstanceOf(NotificationDelivery)
    if (!(delivery instanceof NotificationDelivery)) return

    const readAt = new Date("2026-08-11T00:01:00.000Z")
    const read = delivery.markRead(readAt)
    expect(read).toBeInstanceOf(NotificationDelivery)
    if (!(read instanceof NotificationDelivery)) return

    expect(delivery.isRead).toBe(false)
    expect(read.isRead).toBe(true)
    expect(read.readAt).toEqual(readAt)
    expect(read.markRead(new Date("2026-08-11T00:02:00.000Z"))).toBe(read)

    const regressed = read.markRead(new Date("2026-08-11T00:00:30.000Z"))
    expect(regressed).toBeInstanceOf(InvalidNotificationDeliveryError)
    if (regressed instanceof InvalidNotificationDeliveryError) {
      expect(regressed.reason).toBe("transition_before_last_update")
    }
  })

  test("配信前の既読を拒否する", () => {
    const delivery = NotificationDelivery.create(validProps)
    expect(delivery).toBeInstanceOf(NotificationDelivery)
    if (!(delivery instanceof NotificationDelivery)) return

    const result = delivery.markRead(new Date("2026-08-10T23:59:59.999Z"))

    expect(result).toBeInstanceOf(InvalidNotificationDeliveryError)
    if (result instanceof InvalidNotificationDeliveryError) {
      expect(result.reason).toBe("read_before_delivery")
    }
  })

  test.each([
    ["empty delivery id", { ...validProps, id: "" }],
    ["empty message id", { ...validProps, messageId: "" }],
    ["empty Account id", { ...validProps, recipientAccountId: "" }],
    ["nullable recipient", { ...validProps, recipientAccountId: null }],
    ["invalid delivery clock", { ...validProps, deliveredAt: new Date(Number.NaN) }],
    ["read before delivery", { ...validProps, readAt: new Date("2026-08-10T23:59:59.999Z") }],
    ["retired user recipient", { ...validProps, userId: "user-1" }],
  ])("fails closed for %s", (_name, input) => {
    const result = NotificationDelivery.create(input)

    expect(result).toBeInstanceOf(InvalidNotificationDeliveryError)
  })

  test("不正な既読時刻を例外にせずfail closedで拒否する", () => {
    const delivery = NotificationDelivery.create(validProps)
    expect(delivery).toBeInstanceOf(NotificationDelivery)
    if (!(delivery instanceof NotificationDelivery)) return

    const result = delivery.markRead(new Date(Number.NaN))

    expect(result).toBeInstanceOf(InvalidNotificationDeliveryError)
    if (result instanceof InvalidNotificationDeliveryError) {
      expect(result.reason).toBe("invalid_shape")
    }
  })
})
