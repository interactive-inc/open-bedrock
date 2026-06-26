import { canManageRooms } from "@/lib/room/can-manage-rooms"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageRooms", () => {
  test("manager can manage", () => {
    expect(canManageRooms(makeTestSession("manager"))).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManageRooms(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageRooms(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageRooms(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageRooms(makeTestSession("unknown"))).toBe(false)
  })
})
