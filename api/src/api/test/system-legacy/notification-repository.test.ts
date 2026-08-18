import { Notification } from "@/contexts/system-compatibility/domain/notifications/legacy-notification.entity"
import { NotificationRepository } from "@/contexts/system-compatibility/infrastructure/notifications/notification-repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import { describe, expect, test } from "bun:test"

describe("NotificationRepository", () => {
  test("create then findById round-trips the notification", async () => {
    const { context } = createTestContext()
    const repository = new NotificationRepository(context)
    const created = await repository.create(
      Notification.create({
        recipientAccountId: 1,
        kind: "resource_changed",
        title: "Test notification",
        body: "Body",
        sourceDomain: "resource",
        sourceId: 10,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    expect(created).toBeInstanceOf(Notification)

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const found = await repository.findById(created.id)

    expect(found).toBeInstanceOf(Notification)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.title).toBe("Test notification")
    expect(found.isRead).toBe(false)
  })

  test("update persists the read flag", async () => {
    const { context } = createTestContext()
    const repository = new NotificationRepository(context)
    const created = await repository.create(
      Notification.create({
        recipientAccountId: 1,
        kind: "resource_changed",
        title: "Test notification",
        body: null,
        sourceDomain: "resource",
        sourceId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    if (created instanceof Error) {
      throw created
    }

    const updated = await repository.update(created.markRead())

    expect(updated).toBeInstanceOf(Notification)

    if (updated instanceof Error || updated === null) {
      throw new Error("update failed")
    }

    expect(updated.isRead).toBe(true)
  })

  test("markAllRead returns the number of updated notifications", async () => {
    const { context } = createTestContext()
    const repository = new NotificationRepository(context)

    await repository.create(
      Notification.create({
        recipientAccountId: 1,
        kind: "resource_changed",
        title: "First",
        body: null,
        sourceDomain: "resource",
        sourceId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    await repository.create(
      Notification.create({
        recipientAccountId: 1,
        kind: "resource_changed",
        title: "Second",
        body: null,
        sourceDomain: "resource",
        sourceId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    const count = await repository.markAllRead(1)

    expect(count).toBe(2)
  })
})
