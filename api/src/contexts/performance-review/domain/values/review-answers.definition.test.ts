import { toAnswers } from "@/contexts/performance-review/domain/values/review-answers.definition"
import { describe, expect, test } from "bun:test"

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
