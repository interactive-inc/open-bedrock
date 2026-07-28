import { toReviewerType } from "@/lib/review/to-reviewer-type"
import { describe, expect, test } from "bun:test"

describe("toReviewerType", () => {
  test("manager returns manager", () => {
    expect(toReviewerType("manager")).toBe("manager")
  })

  test("peer returns peer", () => {
    expect(toReviewerType("peer")).toBe("peer")
  })

  test("subordinate returns subordinate", () => {
    expect(toReviewerType("subordinate")).toBe("subordinate")
  })

  test("self returns self", () => {
    expect(toReviewerType("self")).toBe("self")
  })

  test("unknown returns self", () => {
    expect(toReviewerType("other")).toBe("self")
  })
})
