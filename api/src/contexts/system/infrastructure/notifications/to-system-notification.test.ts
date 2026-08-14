import {
  toSystemNotificationDelivery,
  toSystemNotificationMessage,
} from "@system/infrastructure/notifications/to-system-notification"
import { describe, expect, test } from "bun:test"

describe("canonical System Notification row conversion", () => {
  test("MessageとDeliveryのD1 rowをDomainへ復元する", () => {
    const message = toSystemNotificationMessage({
      id: "message-1",
      kind: "system:test.created",
      title: "plain title",
      body: null,
      source_type: "system:test.source",
      source_id: "source-1",
      created_at: 1_000,
    })
    const delivery = toSystemNotificationDelivery({
      id: "delivery-1",
      message_id: "message-1",
      recipient_account_id: "account-1",
      delivered_at: 2_000,
      read_at: null,
    })

    expect(message).not.toBeInstanceOf(Error)
    expect(delivery).not.toBeInstanceOf(Error)
    if (message instanceof Error || delivery instanceof Error) return

    expect(message.source).toEqual({ type: "system:test.source", id: "source-1" })
    expect(message.createdAt).toEqual(new Date(1_000))
    expect(String(delivery.recipientAccountId)).toBe("account-1")
    expect(delivery.deliveredAt).toEqual(new Date(2_000))
  })

  test("壊れたsource pair・時系列・型をDomainへ丸めず拒否する", () => {
    expect(
      toSystemNotificationMessage({
        id: "message-1",
        kind: "system:test.created",
        title: "plain title",
        body: null,
        source_type: "system:test.source",
        source_id: null,
        created_at: 1_000,
      }),
    ).toBeInstanceOf(Error)
    expect(
      toSystemNotificationDelivery({
        id: "delivery-1",
        message_id: "message-1",
        recipient_account_id: "account-1",
        delivered_at: 2_000,
        read_at: 1_999,
      }),
    ).toBeInstanceOf(Error)
    expect(toSystemNotificationDelivery("not a row")).toBeInstanceOf(Error)
  })
})
