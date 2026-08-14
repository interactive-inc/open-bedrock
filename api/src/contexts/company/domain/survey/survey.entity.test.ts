import { Survey } from "@/domain/survey/survey.entity"
import { describe, expect, test } from "bun:test"

describe("Survey.fromRow", () => {
  test("builds a Survey from a row with valid questions JSON", () => {
    const survey = Survey.fromRow({
      id: 1,
      title: "満足度調査",
      status: "open",
      questionsJson: JSON.stringify([{ id: "q1", type: "scale" }]),
    })

    expect(survey).toBeInstanceOf(Survey)

    if (survey instanceof Error) {
      throw survey
    }

    expect(survey.id).toBe(1)
    expect(survey.title).toBe("満足度調査")
    expect(survey.status).toBe("open")
    expect(survey.questionsJson.length).toBe(1)
  })

  test("treats unknown status as closed", () => {
    const survey = Survey.fromRow({
      id: 2,
      title: "古い調査",
      status: "archived",
      questionsJson: "[]",
    })

    if (survey instanceof Error) {
      throw survey
    }

    expect(survey.status).toBe("closed")
  })

  test("returns Error when questionsJson is not valid JSON", () => {
    const result = Survey.fromRow({
      id: 3,
      title: "破損",
      status: "open",
      questionsJson: "{not-json",
    })

    expect(result).toBeInstanceOf(Error)
  })

  test("returns Error when questionsJson is valid JSON but not an array", () => {
    const result = Survey.fromRow({
      id: 4,
      title: "型違い",
      status: "open",
      questionsJson: JSON.stringify({ wrong: "shape" }),
    })

    expect(result).toBeInstanceOf(Error)
  })
})
