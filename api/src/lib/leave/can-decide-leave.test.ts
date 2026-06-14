import { canDecideLeave } from "@/lib/leave/can-decide-leave"
import { describe, expect, test } from "bun:test"

describe("canDecideLeave", () => {
  test("manager can decide", () => {
    expect(canDecideLeave("manager")).toBe(true)
  })

  test("hr can decide", () => {
    expect(canDecideLeave("hr")).toBe(true)
  })

  test("admin can decide", () => {
    expect(canDecideLeave("admin")).toBe(true)
  })

  test("member cannot decide", () => {
    expect(canDecideLeave("member")).toBe(false)
  })

  test("unknown role cannot decide", () => {
    expect(canDecideLeave("unknown")).toBe(false)
  })
})
