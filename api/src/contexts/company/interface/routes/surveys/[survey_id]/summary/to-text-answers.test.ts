import { toTextAnswers } from "@/contexts/company/interface/routes/surveys/[survey_id]/summary/to-text-answers"
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

  test("sorts answers so the order does not follow the respondent order", () => {
    // 回答者順（配列の並び）は降順。ソート後は昇順になり、回答者位置と無関係になる。
    const answersList = [{ q1: "charlie" }, { q1: "bravo" }, { q1: "alpha" }]

    const textAnswers = toTextAnswers("q1", answersList)

    expect(textAnswers).toEqual(["alpha", "bravo", "charlie"])
  })

  test("sorts each question independently so cross-question positions cannot re-identify a respondent", () => {
    // 各回答者が2設問に回答。設問ごとに独立してソートされるため、
    // answers[i] を設問横断で突合しても同一回答者の回答は復元できない。
    const answersList = [
      { q1: "zoo", q2: "alpha" },
      { q1: "apple", q2: "zulu" },
    ]

    const q1Answers = toTextAnswers("q1", answersList)
    const q2Answers = toTextAnswers("q2", answersList)

    expect(q1Answers).toEqual(["apple", "zoo"])
    expect(q2Answers).toEqual(["alpha", "zulu"])

    // 元の回答者0は (q1="zoo", q2="alpha") だが、ソート後は
    // q1 で index 1、q2 で index 0 に散らばり位置突合が崩れる。
    expect(q1Answers.indexOf("zoo")).not.toBe(q2Answers.indexOf("alpha"))
  })
})
