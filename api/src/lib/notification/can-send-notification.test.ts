import { canSendNotification } from "@/lib/notification/can-send-notification"
import { describe, expect, test } from "bun:test"

describe("canSendNotification", () => {
  test("manager can send", () => {
    expect(canSendNotification("manager")).toBe(true)
  })

  test("hr can send", () => {
    expect(canSendNotification("hr")).toBe(true)
  })

  test("admin can send", () => {
    expect(canSendNotification("admin")).toBe(true)
  })

  test("member cannot send", () => {
    expect(canSendNotification("member")).toBe(false)
  })

  test("unknown role cannot send", () => {
    expect(canSendNotification("unknown")).toBe(false)
  })
})
