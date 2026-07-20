import { canManageAntisocialChecks } from "@/lib/antisocial-check/can-manage-antisocial-checks"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageAntisocialChecks", () => {
  test("manager can manage", () => {
    expect(canManageAntisocialChecks(makeTestSession("manager"))).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManageAntisocialChecks(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageAntisocialChecks(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageAntisocialChecks(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageAntisocialChecks(makeTestSession("unknown"))).toBe(false)
  })
})
