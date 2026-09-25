import { Survey } from "@/contexts/survey/domain/entities/survey.entity"
import { describe, expect, test } from "bun:test"

describe("Survey.fromRow", () => {
  test("builds a Survey from a row with valid questions JSON", () => {
    const survey = Survey.fromRow({
      id: "01900026-0000-7000-8000-000000000001",
      title: "満足度調査",
      status: "open",
      questionsJson: JSON.stringify([{ id: "q1", type: "scale" }]),
      legacyId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(survey).toBeInstanceOf(Survey)

    if (survey instanceof Error) {
      throw survey
    }

    expect(survey.id).toBe("01900026-0000-7000-8000-000000000001")
    expect(survey.title).toBe("満足度調査")
    expect(survey.status).toBe("open")
    expect(survey.questionsJson.length).toBe(1)
  })

  test("treats unknown status as closed", () => {
    const survey = Survey.fromRow({
      id: "01900026-0000-7000-8000-000000000002",
      title: "古い調査",
      status: "archived",
      questionsJson: "[]",
      legacyId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    if (survey instanceof Error) {
      throw survey
    }

    expect(survey.status).toBe("closed")
  })

  test("returns Error when questionsJson is not valid JSON", () => {
    const result = Survey.fromRow({
      id: "01900026-0000-7000-8000-000000000003",
      title: "破損",
      status: "open",
      questionsJson: "{not-json",
      legacyId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(Error)
  })

  test("returns Error when questionsJson is valid JSON but not an array", () => {
    const result = Survey.fromRow({
      id: "01900026-0000-7000-8000-000000000004",
      title: "型違い",
      status: "open",
      questionsJson: JSON.stringify({ wrong: "shape" }),
      legacyId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(Error)
  })
})
