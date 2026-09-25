import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { SurveyResponse } from "@/contexts/survey/domain/entities/survey-response.entity"
import { describe, expect, test } from "bun:test"

describe("SurveyResponse.fromRow", () => {
  test("builds a SurveyResponse from a row with valid answers JSON", () => {
    const response = SurveyResponse.fromRow({
      id: "01900027-0000-7000-8000-00000000000b",
      surveyId: "01900026-0000-7000-8000-000000000001",
      respondentId: toWorkforceEmployeeId(7),
      answersJson: JSON.stringify({ q1: 5 }),
      submittedAt: "2026-01-01T00:00:00.000Z",
      legacyId: null,
    })

    expect(response).toBeInstanceOf(SurveyResponse)

    if (response instanceof Error) {
      throw response
    }

    expect(response.id).toBe("01900027-0000-7000-8000-00000000000b")
    expect(response.surveyId).toBe("01900026-0000-7000-8000-000000000001")
    expect(response.respondentId).toBe(toWorkforceEmployeeId(7))
    expect(response.submittedAt).toBe("2026-01-01T00:00:00.000Z")
  })

  test("accepts null JSON as the literal null value", () => {
    const response = SurveyResponse.fromRow({
      id: "01900027-0000-7000-8000-00000000000c",
      surveyId: "01900026-0000-7000-8000-000000000001",
      respondentId: toWorkforceEmployeeId(7),
      answersJson: "null",
      submittedAt: "2026-01-02T00:00:00.000Z",
      legacyId: null,
    })

    if (response instanceof Error) {
      throw response
    }

    expect(response.answersJson).toBeNull()
  })

  test("returns Error when answersJson is not valid JSON", () => {
    const result = SurveyResponse.fromRow({
      id: "01900027-0000-7000-8000-00000000000d",
      surveyId: "01900026-0000-7000-8000-000000000001",
      respondentId: toWorkforceEmployeeId(7),
      answersJson: "{not-json",
      submittedAt: "2026-01-03T00:00:00.000Z",
      legacyId: null,
    })

    expect(result).toBeInstanceOf(Error)
  })
})
