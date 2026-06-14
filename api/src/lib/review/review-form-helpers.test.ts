import { toAnswers, toFormStatus, toReviewerType } from "@/lib/review/review-form-helpers"
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

describe("toFormStatus", () => {
  test("submitted returns submitted", () => {
    expect(toFormStatus("submitted")).toBe("submitted")
  })

  test("pending returns pending", () => {
    expect(toFormStatus("pending")).toBe("pending")
  })

  test("unknown returns pending", () => {
    expect(toFormStatus("draft")).toBe("pending")
  })
})

describe("toAnswers", () => {
  test("valid JSON array returns the array", () => {
    const answers = toAnswers(JSON.stringify([1, 2, 3]))

    expect(answers.length).toBe(3)
  })

  test("non-array JSON returns empty array", () => {
    const answers = toAnswers(JSON.stringify({ a: 1 }))

    expect(answers.length).toBe(0)
  })

  test("invalid JSON returns empty array", () => {
    const answers = toAnswers("{not-json")

    expect(answers.length).toBe(0)
  })
})
