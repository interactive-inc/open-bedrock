import { Survey } from "@/domain/survey/survey"
import { SurveyResponse } from "@/domain/survey/survey-response"
import { SurveyRepository } from "@/infrastructure/survey/survey-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { describe, expect, test } from "bun:test"

describe("SurveyRepository", () => {
  test("findById returns the seeded survey", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "surveys", [
      {
        id: 1,
        title: "従業員満足度調査",
        status: "open",
        questions_json: JSON.stringify([{ id: "q1", label: "満足度" }]),
      },
    ])

    const repository = new SurveyRepository(context)

    const found = await repository.findById(1)

    expect(found).toBeInstanceOf(Survey)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.title).toBe("従業員満足度調査")
    expect(found.status).toBe("open")
  })

  test("findById returns null for an unknown id", async () => {
    const { context } = createTestContext()

    const repository = new SurveyRepository(context)

    const found = await repository.findById(9999)

    expect(found).toBeNull()
  })

  test("createResponse then findResponseBySurveyIdAndRespondentId round-trips the response", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "surveys", [
      {
        id: 1,
        title: "テスト調査",
        status: "open",
        questions_json: JSON.stringify([{ id: "q1", label: "満足度" }]),
      },
    ])

    const repository = new SurveyRepository(context)

    const created = await repository.createResponse(
      SurveyResponse.create({
        surveyId: 1,
        respondentId: 2,
        answersJson: { q1: 5 },
        submittedAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    expect(created).toBeInstanceOf(SurveyResponse)

    if (created instanceof Error || created === null || created.id === null) {
      throw new Error("createResponse failed")
    }

    const found = await repository.findResponseBySurveyIdAndRespondentId(1, 2)

    expect(found).toBeInstanceOf(SurveyResponse)

    if (found instanceof Error || found === null) {
      throw new Error("findResponseBySurveyIdAndRespondentId failed")
    }

    expect(found.surveyId).toBe(1)
    expect(found.respondentId).toBe(2)
  })

  test("findResponseBySurveyIdAndRespondentId returns null when none matches", async () => {
    const { context } = createTestContext()

    const repository = new SurveyRepository(context)

    const found = await repository.findResponseBySurveyIdAndRespondentId(9999, 9999)

    expect(found).toBeNull()
  })
})
