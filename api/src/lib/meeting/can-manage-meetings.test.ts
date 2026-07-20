import { canManageMeetings } from "@/lib/meeting/can-manage-meetings"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageMeetings", () => {
  test("admin can manage", () => {
    expect(canManageMeetings(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageMeetings(makeTestSession("member"))).toBe(false)
  })

  test("manager cannot manage", () => {
    expect(canManageMeetings(makeTestSession("manager"))).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageMeetings(makeTestSession("unknown"))).toBe(false)
  })
})
