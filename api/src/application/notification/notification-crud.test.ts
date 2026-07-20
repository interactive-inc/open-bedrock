import { describe, expect, test } from "bun:test"
import { Notification } from "@/domain/notification/notification.entity"
import { SendNotification } from "@/application/notification/send-notification"
import { GetNotification } from "@/application/notification/get-notification"
import { MarkNotificationRead } from "@/application/notification/mark-notification-read"
import { MarkAllNotificationsRead } from "@/application/notification/mark-all-notifications-read"
import { DeleteNotification } from "@/application/notification/delete-notification"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { expectApplicationError } from "@/interface/test-helpers/expect-application-error"
import { ForbiddenError, NotFoundError } from "@/lib/errors"
import type { Context } from "@/env"

async function seedEmployee(db: D1Database, code: string, id: number) {
  await seedD1(db, "employees", [
    {
      id: id,
      code: code,
      name: "Test Employee",
      dept_id: 1,
      dept_name: "Engineering",
      position: "Engineer",
      status: "active",
    },
  ])
}

async function createNotification(
  context: Context,
  db: D1Database,
  recipientCode: string,
  recipientId: number,
): Promise<Notification> {
  await seedEmployee(db, recipientCode, recipientId)

  const result = await new SendNotification(context).run({
    session: makeTestSession("admin"),
    recipientEmployeeCode: recipientCode,
    kind: "announcement",
    title: "Test notification",
    body: "Test body",
    sourceDomain: "test",
    sourceId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  })

  if (result instanceof Error) {
    throw new Error("seed notification failed")
  }

  return result
}

describe("SendNotification", () => {
  test("sends a notification as admin", async () => {
    const { context, db } = createTestContext()

    await seedEmployee(db, "E001", 1)

    const result = await new SendNotification(context).run({
      session: makeTestSession("admin"),
      recipientEmployeeCode: "E001",
      kind: "announcement",
      title: "Welcome",
      body: "Hello!",
      sourceDomain: "system",
      sourceId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(Notification)

    if (result instanceof Error) {
      throw new Error("send failed")
    }

    expect(result.title).toBe("Welcome")
    expect(result.isRead).toBe(false)
  })

  test("sends a notification as manager", async () => {
    const { context, db } = createTestContext()

    await seedEmployee(db, "E001", 1)

    const result = await new SendNotification(context).run({
      session: makeTestSession("manager"),
      recipientEmployeeCode: "E001",
      kind: "task",
      title: "New task",
      body: null,
      sourceDomain: "oneonone",
      sourceId: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(Notification)
  })

  test("rejects member role with notification_forbidden", async () => {
    const { context } = createTestContext()

    const result = await new SendNotification(context).run({
      session: makeTestSession("member"),
      recipientEmployeeCode: "E001",
      kind: "announcement",
      title: "Test",
      body: null,
      sourceDomain: "test",
      sourceId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "notification_forbidden")
  })

  test("rejects unknown recipient with recipient_not_found", async () => {
    const { context } = createTestContext()

    const result = await new SendNotification(context).run({
      session: makeTestSession("admin"),
      recipientEmployeeCode: "NOPE",
      kind: "announcement",
      title: "Test",
      body: null,
      sourceDomain: "test",
      sourceId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expectApplicationError(result, NotFoundError, "recipient_not_found")
  })
})

describe("GetNotification", () => {
  test("returns the notification for the recipient", async () => {
    const { context, db } = createTestContext()
    const notification = await createNotification(context, db, "E001", 1)

    if (notification.id === null) {
      throw new Error("id is null")
    }

    const result = await new GetNotification(context).run({
      notificationId: notification.id,
      viewerEmployeeId: 1,
    })

    expect(result).toBeInstanceOf(Notification)
  })

  test("rejects non-recipient with notification_forbidden", async () => {
    const { context, db } = createTestContext()
    const notification = await createNotification(context, db, "E001", 1)

    if (notification.id === null) {
      throw new Error("id is null")
    }

    const result = await new GetNotification(context).run({
      notificationId: notification.id,
      viewerEmployeeId: 999,
    })

    expectApplicationError(result, NotFoundError, "notification_forbidden")
  })

  test("rejects unknown id with notification_not_found", async () => {
    const { context } = createTestContext()

    const result = await new GetNotification(context).run({
      notificationId: 9999,
      viewerEmployeeId: 1,
    })

    expectApplicationError(result, NotFoundError, "notification_not_found")
  })
})

describe("MarkNotificationRead", () => {
  test("marks notification as read for the recipient", async () => {
    const { context, db } = createTestContext()
    const notification = await createNotification(context, db, "E001", 1)

    if (notification.id === null) {
      throw new Error("id is null")
    }

    const result = await new MarkNotificationRead(context).run({
      notificationId: notification.id,
      viewerEmployeeId: 1,
    })

    expect(result).toBeInstanceOf(Notification)

    if (result instanceof Error) {
      throw new Error("mark read failed")
    }

    expect(result.isRead).toBe(true)
  })

  test("rejects non-recipient with notification_forbidden", async () => {
    const { context, db } = createTestContext()
    const notification = await createNotification(context, db, "E001", 1)

    if (notification.id === null) {
      throw new Error("id is null")
    }

    const result = await new MarkNotificationRead(context).run({
      notificationId: notification.id,
      viewerEmployeeId: 999,
    })

    expectApplicationError(result, NotFoundError, "notification_forbidden")
  })
})

describe("MarkAllNotificationsRead", () => {
  test("marks all notifications as read and returns count", async () => {
    const { context, db } = createTestContext()
    await seedEmployee(db, "E001", 1)

    await new SendNotification(context).run({
      session: makeTestSession("admin"),
      recipientEmployeeCode: "E001",
      kind: "announcement",
      title: "First",
      body: null,
      sourceDomain: "test",
      sourceId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    await new SendNotification(context).run({
      session: makeTestSession("admin"),
      recipientEmployeeCode: "E001",
      kind: "reminder",
      title: "Second",
      body: null,
      sourceDomain: "test",
      sourceId: null,
      createdAt: "2026-01-01T01:00:00.000Z",
    })

    const result = await new MarkAllNotificationsRead(context).run({
      recipientEmployeeId: 1,
    })

    if (result instanceof Error) {
      throw new Error("mark all read failed")
    }

    expect(result).toBe(2)
  })

  test("returns 0 when no notifications exist", async () => {
    const { context } = createTestContext()

    const result = await new MarkAllNotificationsRead(context).run({
      recipientEmployeeId: 1,
    })

    if (result instanceof Error) {
      throw new Error("mark all read failed")
    }

    expect(result).toBe(0)
  })
})

describe("DeleteNotification", () => {
  test("deletes the notification for the recipient", async () => {
    const { context, db } = createTestContext()
    const notification = await createNotification(context, db, "E001", 1)

    if (notification.id === null) {
      throw new Error("id is null")
    }

    const result = await new DeleteNotification(context).run({
      notificationId: notification.id,
      viewerEmployeeId: 1,
    })

    expect(result).toEqual({ reason: "deleted" })
  })

  test("rejects non-recipient or unknown id with not_found", async () => {
    const { context, db } = createTestContext()
    const notification = await createNotification(context, db, "E001", 1)

    if (notification.id === null) {
      throw new Error("id is null")
    }

    const result = await new DeleteNotification(context).run({
      notificationId: notification.id,
      viewerEmployeeId: 999,
    })

    expectApplicationError(result, NotFoundError, "not_found")
  })
})
