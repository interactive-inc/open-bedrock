import { SurveyResponse } from "@/domain/survey/survey-response.entity"
import { describe, expect, test } from "bun:test"

describe("SurveyResponse.fromRow", () => {
  test("builds a SurveyResponse from a row with valid answers JSON", () => {
    const response = SurveyResponse.fromRow({
      id: 11,
      surveyId: 1,
      respondentId: 7,
      answersJson: JSON.stringify({ q1: 5 }),
      submittedAt: "2026-01-01T00:00:00.000Z",
    })

    expect(response).toBeInstanceOf(SurveyResponse)

    if (response instanceof Error) {
      throw response
    }

    expect(response.id).toBe(11)
    expect(response.surveyId).toBe(1)
    expect(response.respondentId).toBe(7)
    expect(response.submittedAt).toBe("2026-01-01T00:00:00.000Z")
  })

  test("accepts null JSON as the literal null value", () => {
    const response = SurveyResponse.fromRow({
      id: 12,
      surveyId: 1,
      respondentId: 7,
      answersJson: "null",
      submittedAt: "2026-01-02T00:00:00.000Z",
    })

    if (response instanceof Error) {
      throw response
    }

    expect(response.answersJson).toBeNull()
  })

  test("returns Error when answersJson is not valid JSON", () => {
    const result = SurveyResponse.fromRow({
      id: 13,
      surveyId: 1,
      respondentId: 7,
      answersJson: "{not-json",
      submittedAt: "2026-01-03T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(Error)
  })
})
