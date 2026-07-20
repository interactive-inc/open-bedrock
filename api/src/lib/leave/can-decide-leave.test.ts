import { canDecideLeave } from "@/lib/leave/can-decide-leave"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canDecideLeave", () => {
  test("manager can decide", () => {
    expect(canDecideLeave(makeTestSession("manager"))).toBe(true)
  })

  test("hr can decide", () => {
    expect(canDecideLeave(makeTestSession("hr"))).toBe(true)
  })

  test("admin can decide", () => {
    expect(canDecideLeave(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot decide", () => {
    expect(canDecideLeave(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot decide", () => {
    expect(canDecideLeave(makeTestSession("unknown"))).toBe(false)
  })
})
