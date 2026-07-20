import { canManageCareerPostings } from "@/lib/career/can-manage-career-postings"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageCareerPostings", () => {
  test("manager can manage", () => {
    expect(canManageCareerPostings(makeTestSession("manager"))).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManageCareerPostings(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageCareerPostings(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageCareerPostings(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageCareerPostings(makeTestSession("viewer"))).toBe(false)
  })
})
