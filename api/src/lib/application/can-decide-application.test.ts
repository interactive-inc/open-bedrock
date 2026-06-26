import { canDecideApplication } from "@/lib/application/can-decide-application"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canDecideApplication", () => {
  test("manager can decide", () => {
    expect(canDecideApplication(makeTestSession("manager"))).toBe(true)
  })

  test("hr can decide", () => {
    expect(canDecideApplication(makeTestSession("hr"))).toBe(true)
  })

  test("admin can decide", () => {
    expect(canDecideApplication(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot decide", () => {
    expect(canDecideApplication(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot decide", () => {
    expect(canDecideApplication(makeTestSession("viewer"))).toBe(false)
  })
})
