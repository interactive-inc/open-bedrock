import { canManageCareerPostings } from "@/lib/career/can-manage-career-postings"
import { describe, expect, test } from "bun:test"

describe("canManageCareerPostings", () => {
  test("manager can manage", () => {
    expect(canManageCareerPostings("manager")).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManageCareerPostings("hr")).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageCareerPostings("admin")).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageCareerPostings("member")).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageCareerPostings("viewer")).toBe(false)
  })
})
