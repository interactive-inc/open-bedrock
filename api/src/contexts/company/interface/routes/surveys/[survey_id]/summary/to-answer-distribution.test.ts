import { toAnswerDistribution } from "@/interface/routes/surveys/[survey_id]/summary/to-answer-distribution"
import { describe, expect, test } from "bun:test"

describe("toAnswerDistribution", () => {
  test("counts string answers", () => {
    const answersList = [{ q1: "good" }, { q1: "good" }, { q1: "bad" }]

    const distribution = toAnswerDistribution("q1", answersList)

    expect(distribution["good"]).toBe(2)
    expect(distribution["bad"]).toBe(1)
  })

  test("counts numeric answers", () => {
    const answersList = [{ q1: 5 }, { q1: 5 }, { q1: 3 }]

    const distribution = toAnswerDistribution("q1", answersList)

    expect(distribution["5"]).toBe(2)
    expect(distribution["3"]).toBe(1)
  })

  test("counts boolean answers", () => {
    const answersList = [{ q1: true }, { q1: false }, { q1: true }]

    const distribution = toAnswerDistribution("q1", answersList)

    expect(distribution["true"]).toBe(2)
    expect(distribution["false"]).toBe(1)
  })

  test("ignores null, undefined, and empty string", () => {
    const answersList = [{ q1: null }, { q1: "" }, {}]

    const distribution = toAnswerDistribution("q1", answersList)

    expect(Object.keys(distribution).length).toBe(0)
  })

  test("ignores arrays and objects", () => {
    const answersList = [{ q1: [1, 2] }, { q1: { nested: true } }]

    const distribution = toAnswerDistribution("q1", answersList)

    expect(Object.keys(distribution).length).toBe(0)
  })
})
