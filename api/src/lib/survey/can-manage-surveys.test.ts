import { canManageSurveys } from "@/lib/survey/can-manage-surveys"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageSurveys", () => {
  test("manager can manage", () => {
    expect(canManageSurveys(makeTestSession("manager"))).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManageSurveys(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageSurveys(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageSurveys(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageSurveys(makeTestSession("viewer"))).toBe(false)
  })
})
