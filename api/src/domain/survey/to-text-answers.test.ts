import { toTextAnswers } from "@/domain/survey/to-text-answers"
import { describe, expect, test } from "bun:test"

describe("toTextAnswers", () => {
  test("collects string answers for given question", () => {
    const answersList = [{ q1: "Good service" }, { q1: "Needs improvement" }]

    const textAnswers = toTextAnswers("q1", answersList)

    expect(textAnswers.length).toBe(2)
    expect(textAnswers[0]).toBe("Good service")
    expect(textAnswers[1]).toBe("Needs improvement")
  })

  test("ignores non-string values", () => {
    const answersList = [{ q1: 5 }, { q1: true }, { q1: null }, {}]

    const textAnswers = toTextAnswers("q1", answersList)

    expect(textAnswers.length).toBe(0)
  })

  test("ignores empty strings", () => {
    const answersList = [{ q1: "" }, { q1: "valid" }]

    const textAnswers = toTextAnswers("q1", answersList)

    expect(textAnswers.length).toBe(1)
    expect(textAnswers[0]).toBe("valid")
  })
})
