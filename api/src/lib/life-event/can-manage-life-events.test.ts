import { canManageLifeEvents } from "@/lib/life-event/can-manage-life-events"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageLifeEvents", () => {
  test("hr can manage", () => {
    expect(canManageLifeEvents(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageLifeEvents(makeTestSession("admin"))).toBe(true)
  })

  test("manager cannot manage", () => {
    expect(canManageLifeEvents(makeTestSession("manager"))).toBe(false)
  })

  test("member cannot manage", () => {
    expect(canManageLifeEvents(makeTestSession("member"))).toBe(false)
  })
})
