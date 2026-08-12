import { Notification } from "@system/domain/notifications/notification.entity"
import { describe, expect, test } from "bun:test"

describe("Notification.create", () => {
  test("builds with null id and isRead false", () => {
    const notification = Notification.create({
      recipientAccountId: 1,
      kind: "resource_changed",
      title: "Resource changed",
      body: "Review the change",
      sourceDomain: "resource",
      sourceId: 42,
      createdAt: "2026-06-11T09:00:00.000Z",
    })

    expect(notification).toBeInstanceOf(Notification)
    expect(notification.id).toBeNull()
    expect(notification.isRead).toBe(false)
    expect(notification.recipientAccountId).toBe(1)
    expect(notification.kind).toBe("resource_changed")
    expect(notification.title).toBe("Resource changed")
    expect(notification.body).toBe("Review the change")
    expect(notification.sourceDomain).toBe("resource")
    expect(notification.sourceId).toBe(42)
    expect(notification.createdAt).toBe("2026-06-11T09:00:00.000Z")
  })

  test("accepts null body and null sourceId", () => {
    const notification = Notification.create({
      recipientAccountId: 2,
      kind: "system_message",
      title: "System message",
      body: null,
      sourceDomain: "system",
      sourceId: null,
      createdAt: "2026-06-11T10:00:00.000Z",
    })

    expect(notification.body).toBeNull()
    expect(notification.sourceId).toBeNull()
  })
})

describe("Notification.markRead", () => {
  test("returns new notification with isRead true", () => {
    const notification = Notification.create({
      recipientAccountId: 1,
      kind: "reminder",
      title: "Reminder",
      body: null,
      sourceDomain: "resource",
      sourceId: 10,
      createdAt: "2026-06-11T09:00:00.000Z",
    })

    const read = notification.markRead()

    expect(read).toBeInstanceOf(Notification)
    expect(read.isRead).toBe(true)
    expect(read.recipientAccountId).toBe(1)
    expect(read.title).toBe("Reminder")
  })
})
