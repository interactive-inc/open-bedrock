import { canReadAllGoals } from "@/lib/goal/can-read-all-goals"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canReadAllGoals", () => {
  test("manager cannot read all (scoped to reports since 0011)", () => {
    expect(canReadAllGoals(makeTestSession("manager"))).toBe(false)
  })

  test("hr can read all", () => {
    expect(canReadAllGoals(makeTestSession("hr"))).toBe(true)
  })

  test("admin can read all", () => {
    expect(canReadAllGoals(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot read all", () => {
    expect(canReadAllGoals(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot read all", () => {
    expect(canReadAllGoals(makeTestSession("viewer"))).toBe(false)
  })
})
