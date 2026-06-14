import { canManageRooms } from "@/lib/room/can-manage-rooms"
import { describe, expect, test } from "bun:test"

describe("canManageRooms", () => {
  test("manager can manage", () => {
    expect(canManageRooms("manager")).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManageRooms("hr")).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageRooms("admin")).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageRooms("member")).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageRooms("unknown")).toBe(false)
  })
})
