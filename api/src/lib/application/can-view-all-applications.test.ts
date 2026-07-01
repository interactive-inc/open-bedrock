import { canViewAllApplications } from "@/lib/application/can-view-all-applications"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canViewAllApplications", () => {
  test("admin can view all", () => {
    expect(canViewAllApplications(makeTestSession("admin"))).toBe(true)
  })

  test("hr can view all", () => {
    expect(canViewAllApplications(makeTestSession("hr"))).toBe(true)
  })

  test("manager cannot view all", () => {
    expect(canViewAllApplications(makeTestSession("manager"))).toBe(false)
  })

  test("member cannot view all", () => {
    expect(canViewAllApplications(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot view all", () => {
    expect(canViewAllApplications(makeTestSession("viewer"))).toBe(false)
  })
})
