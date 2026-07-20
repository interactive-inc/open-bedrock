import { canDecideRedemption } from "@/lib/thanks-points/can-decide-redemption"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canDecideRedemption", () => {
  test("hr can decide", () => {
    expect(canDecideRedemption(makeTestSession("hr"))).toBe(true)
  })

  test("admin can decide", () => {
    expect(canDecideRedemption(makeTestSession("admin"))).toBe(true)
  })

  test("manager cannot decide", () => {
    expect(canDecideRedemption(makeTestSession("manager"))).toBe(false)
  })

  test("member cannot decide", () => {
    expect(canDecideRedemption(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot decide", () => {
    expect(canDecideRedemption(makeTestSession("viewer"))).toBe(false)
  })
})
