import { Notification } from "@/domain/notification/notification.entity"
import { describe, expect, test } from "bun:test"

describe("Notification.create", () => {
  test("builds with null id and isRead false", () => {
    const notification = Notification.create({
      recipientEmployeeId: 1,
      kind: "task",
      title: "新しいタスク",
      body: "確認してください",
      sourceDomain: "application",
      sourceId: 42,
      createdAt: "2026-06-11T09:00:00.000Z",
    })

    expect(notification).toBeInstanceOf(Notification)
    expect(notification.id).toBeNull()
    expect(notification.isRead).toBe(false)
    expect(notification.recipientEmployeeId).toBe(1)
    expect(notification.kind).toBe("task")
    expect(notification.title).toBe("新しいタスク")
    expect(notification.body).toBe("確認してください")
    expect(notification.sourceDomain).toBe("application")
    expect(notification.sourceId).toBe(42)
    expect(notification.createdAt).toBe("2026-06-11T09:00:00.000Z")
  })

  test("accepts null body and null sourceId", () => {
    const notification = Notification.create({
      recipientEmployeeId: 2,
      kind: "announcement",
      title: "お知らせ",
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
      recipientEmployeeId: 1,
      kind: "reminder",
      title: "リマインダー",
      body: null,
      sourceDomain: "attendance",
      sourceId: 10,
      createdAt: "2026-06-11T09:00:00.000Z",
    })

    const read = notification.markRead()

    expect(read).toBeInstanceOf(Notification)
    expect(read.isRead).toBe(true)
    expect(read.recipientEmployeeId).toBe(1)
    expect(read.title).toBe("リマインダー")
  })
})
