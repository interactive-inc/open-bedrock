import { toSystemNotificationMessage } from "@system/infrastructure/notifications/to-system-notification-message.repository"
import { describe, expect, test } from "bun:test"

describe("toSystemNotificationMessage", () => {
  test("D1 rowをMessageへ復元し、壊れたsource pairを拒否する", () => {
    const message = toSystemNotificationMessage({
      id: "message-1",
      kind: "system:test.created",
      title: "plain title",
      body: null,
      source_type: "system:test.source",
      source_id: "source-1",
      created_at: 1_000,
    })

    expect(message).not.toBeInstanceOf(Error)
    if (message instanceof Error) return
    expect(message.source).toEqual({ type: "system:test.source", id: "source-1" })
    expect(message.createdAt).toEqual(new Date(1_000))
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
  })
})
