import { canSendNotification } from "@/lib/notification/can-send-notification"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canSendNotification", () => {
  test("manager can send", () => {
    expect(canSendNotification(makeTestSession("manager"))).toBe(true)
  })

  test("hr can send", () => {
    expect(canSendNotification(makeTestSession("hr"))).toBe(true)
  })

  test("admin can send", () => {
    expect(canSendNotification(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot send", () => {
    expect(canSendNotification(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot send", () => {
    expect(canSendNotification(makeTestSession("unknown"))).toBe(false)
  })
})
