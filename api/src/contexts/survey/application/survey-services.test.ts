import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { describe, expect, test } from "bun:test"
import { CreateSurvey } from "@/contexts/survey/application/create-survey"
import { DeleteSurvey } from "@/contexts/survey/application/delete-survey"
import { SubmitSurveyResponse } from "@/contexts/survey/application/submit-survey-response"
import { UpdateSurvey } from "@/contexts/survey/application/update-survey"
import { UpdateSurveyResponse } from "@/contexts/survey/application/update-survey-response"
import { Survey } from "@/contexts/survey/domain/entities/survey.entity"
import { SurveyResponse } from "@/contexts/survey/domain/entities/survey-response.entity"
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { makeTestSession } from "@tests/api/support/make-test-session"

/**
 * アンケート集約Repositoryの型付きfake。Domain modelだけを保持し、SQLは再現しない。
 * 条件付き削除・条件付き更新のSQLは survey.repository.d1.test.ts がローカルD1で検証する。
 */
class FakeSurveyRepository {
  readonly surveys = new Map<number, Survey>()

  readonly responses = new Map<number, SurveyResponse>()

  private nextSurveyId = 1

  private nextResponseId = 1

  seedSurvey(status: "open" | "closed"): number {
    const id = this.nextSurveyId++
    this.surveys.set(
      id,
      new Survey({ id, title: "Test Survey", status, questionsJson: [{ q: "How are you?" }] }),
    )
    return id
  }

  seedResponse(surveyId: number, respondentId: EmployeeId): number {
    const id = this.nextResponseId++
    this.responses.set(
      id,
      new SurveyResponse({
        id,
        surveyId,
        respondentId,
        answersJson: { a: "fine" },
        submittedAt: "2026-01-01T00:00:00.000Z",
      }),
    )
    return id
  }

  closeSurvey(surveyId: number): void {
    const survey = this.surveys.get(surveyId)
    if (survey === undefined) throw new Error("unknown survey")
    this.surveys.set(surveyId, survey.withDetails({ ...survey, status: "closed" }))
  }

  private hasResponses(surveyId: number): boolean {
    return [...this.responses.values()].some((response) => response.surveyId === surveyId)
  }

  findById = async (surveyId: number) => this.surveys.get(surveyId) ?? null

  create = async (survey: Survey) => {
    const id = this.nextSurveyId++
    const created = new Survey({
      id,
      title: survey.title,
      status: survey.status,
      questionsJson: survey.questionsJson,
    })
    this.surveys.set(id, created)
    return created
  }

  update = async (survey: Survey) => {
    if (survey.id === null || !this.surveys.has(survey.id)) return null
    this.surveys.set(survey.id, survey)
    return survey
  }

  updateIfNoResponses = async (survey: Survey) => {
    if (survey.id === null || this.hasResponses(survey.id)) return null
    return this.update(survey)
  }

  deleteWithResponses = async (survey: Survey) => {
    if (survey.id === null) return new Error("cannot delete unsaved survey")
    const current = this.surveys.get(survey.id)
    if (current === undefined) return { reason: "not_found" as const }
    if (current.isOpen()) return { reason: "not_deletable" as const }
    this.surveys.delete(survey.id)
    for (const [id, response] of this.responses) {
      if (response.surveyId === survey.id) this.responses.delete(id)
    }
    return true as const
  }

  findResponseById = async (responseId: number) => this.responses.get(responseId) ?? null

  findResponseBySurveyIdAndRespondentId = async (surveyId: number, respondentId: EmployeeId) =>
    [...this.responses.values()].find(
      (response) => response.surveyId === surveyId && response.respondentId === respondentId,
    ) ?? null

  createResponse = async (response: SurveyResponse) => {
    if (this.surveys.get(response.surveyId)?.isOpen() !== true) {
      return { reason: "survey_not_open" as const }
    }
    const id = this.nextResponseId++
    const created = new SurveyResponse({
      id,
      surveyId: response.surveyId,
      respondentId: response.respondentId,
      answersJson: response.answersJson,
      submittedAt: response.submittedAt,
    })
    this.responses.set(id, created)
    return created
  }

  updateResponse = async (response: SurveyResponse) => {
    if (response.id === null || !this.responses.has(response.id)) return null
    if (this.surveys.get(response.surveyId)?.isOpen() !== true) {
      return { reason: "survey_not_open" as const }
    }
    this.responses.set(response.id, response)
    return response
  }
}

describe("CreateSurvey", () => {
  test("creates a survey with admin role", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const result = await new CreateSurvey({ surveyRepository }).run({
      session: makeTestSession("root"),
      title: "Engagement Survey",
      status: "open",
      questionsJson: [{ q: "Rate your satisfaction" }],
    })

    expect(result).toBeInstanceOf(Survey)

    if (result instanceof Survey === false) {
      throw new Error("expected Survey")
    }

    expect(result.title).toBe("Engagement Survey")
    expect(result.status).toBe("open")
  })

  test("creates a closed survey", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const result = await new CreateSurvey({ surveyRepository }).run({
      session: makeTestSession("hr"),
      title: "Draft Survey",
      status: "closed",
      questionsJson: [],
    })

    expect(result).toBeInstanceOf(Survey)

    if (result instanceof Survey === false) {
      throw new Error("expected Survey")
    }

    expect(result.status).toBe("closed")
  })

  test("returns forbidden for member role", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const result = await new CreateSurvey({ surveyRepository }).run({
      session: makeTestSession("member"),
      title: "Survey",
      status: "open",
      questionsJson: [],
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
    expect(surveyRepository.surveys.size).toBe(0)
  })
})

describe("DeleteSurvey", () => {
  test("deletes a closed survey", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const surveyId = surveyRepository.seedSurvey("closed")

    const result = await new DeleteSurvey({ surveyRepository }).run({
      session: makeTestSession("root"),
      surveyId: surveyId,
    })

    if (result instanceof Error) {
      throw new Error("expected tagged result")
    }

    expect(result.reason).toBe("deleted")
  })

  test("deletes a closed survey and its responses", async () => {
    const surveyRepository = new FakeSurveyRepository()

    // open で回答を登録してから closed に変更して削除する
    const surveyId = surveyRepository.seedSurvey("open")

    surveyRepository.seedResponse(surveyId, toWorkforceEmployeeId(1))
    surveyRepository.closeSurvey(surveyId)

    const result = await new DeleteSurvey({ surveyRepository }).run({
      session: makeTestSession("root"),
      surveyId: surveyId,
    })

    if (result instanceof Error) {
      throw new Error("expected tagged result")
    }

    expect(result.reason).toBe("deleted")
  })

  test("returns not_deletable for an open survey", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const surveyId = surveyRepository.seedSurvey("open")

    const result = await new DeleteSurvey({ surveyRepository }).run({
      session: makeTestSession("root"),
      surveyId: surveyId,
    })

    expectApplicationError(result, ConflictError, "not_deletable")
    expect(surveyRepository.surveys.has(surveyId)).toBe(true)
  })

  test("returns not_deletable when the survey was reopened before the guarded delete", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const surveyId = surveyRepository.seedSurvey("closed")

    const result = await new DeleteSurvey({
      surveyRepository: {
        findById: surveyRepository.findById,
        deleteWithResponses: async () => ({ reason: "not_deletable" }),
      },
    }).run({ session: makeTestSession("root"), surveyId })

    expectApplicationError(result, ConflictError, "not_deletable")
  })

  test("returns survey_not_found for a missing survey", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const result = await new DeleteSurvey({ surveyRepository }).run({
      session: makeTestSession("root"),
      surveyId: 9999,
    })

    expectApplicationError(result, NotFoundError, "survey_not_found")
  })

  test("returns forbidden for member role", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const result = await new DeleteSurvey({ surveyRepository }).run({
      session: makeTestSession("member"),
      surveyId: 1,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })
})

describe("UpdateSurvey", () => {
  test("updates title and status without changing questions", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const surveyId = surveyRepository.seedSurvey("open")

    const result = await new UpdateSurvey({ surveyRepository }).run({
      session: makeTestSession("root"),
      surveyId: surveyId,
      title: "Updated Title",
      status: "closed",
      questionsJson: [{ q: "How are you?" }],
    })

    expect(result).toBeInstanceOf(Survey)

    if (result instanceof Survey === false) {
      throw new Error("expected Survey")
    }

    expect(result.title).toBe("Updated Title")
    expect(result.status).toBe("closed")
  })

  test("updates questions when no responses exist", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const surveyId = surveyRepository.seedSurvey("open")

    const result = await new UpdateSurvey({ surveyRepository }).run({
      session: makeTestSession("root"),
      surveyId: surveyId,
      title: "Test Survey",
      status: "open",
      questionsJson: [{ q: "New question" }],
    })

    expect(result).toBeInstanceOf(Survey)
  })

  test("returns questions_immutable when responses exist and questions changed", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const surveyId = surveyRepository.seedSurvey("open")

    surveyRepository.seedResponse(surveyId, toWorkforceEmployeeId(1))

    const result = await new UpdateSurvey({ surveyRepository }).run({
      session: makeTestSession("root"),
      surveyId: surveyId,
      title: "Test Survey",
      status: "open",
      questionsJson: [{ q: "Changed question" }],
    })

    expectApplicationError(result, ConflictError, "questions_immutable")
  })

  test("returns survey_not_found for a missing survey", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const result = await new UpdateSurvey({ surveyRepository }).run({
      session: makeTestSession("root"),
      surveyId: 9999,
      title: "Missing",
      status: "open",
      questionsJson: [],
    })

    expectApplicationError(result, NotFoundError, "survey_not_found")
  })

  test("returns forbidden for member role", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const result = await new UpdateSurvey({ surveyRepository }).run({
      session: makeTestSession("member"),
      surveyId: 1,
      title: "Survey",
      status: "open",
      questionsJson: [],
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  // closed → open の再開は回答済みデータとの整合性を壊すため禁止する。
  test("returns survey_reopen_forbidden when reopening a closed survey", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const surveyId = surveyRepository.seedSurvey("closed")

    const result = await new UpdateSurvey({ surveyRepository }).run({
      session: makeTestSession("root"),
      surveyId: surveyId,
      title: "Test Survey",
      status: "open",
      questionsJson: [{ q: "How are you?" }],
    })

    expectApplicationError(result, ConflictError, "survey_reopen_forbidden")
  })

  test("allows staying closed when updating a closed survey", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const surveyId = surveyRepository.seedSurvey("closed")

    const result = await new UpdateSurvey({ surveyRepository }).run({
      session: makeTestSession("root"),
      surveyId: surveyId,
      title: "Updated Title",
      status: "closed",
      questionsJson: [{ q: "How are you?" }],
    })

    expect(result).toBeInstanceOf(Survey)

    if (result instanceof Survey === false) {
      throw new Error("expected Survey")
    }

    expect(result.status).toBe("closed")
  })
})

describe("SubmitSurveyResponse", () => {
  test("submits a response to an open survey", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const surveyId = surveyRepository.seedSurvey("open")

    const result = await new SubmitSurveyResponse({ surveyRepository }).run({
      surveyId: surveyId,
      respondentId: toWorkforceEmployeeId(1),
      answersJson: { a: "great" },
      submittedAt: "2026-02-01T00:00:00.000Z",
    })

    if (result instanceof Error || "reason" in result) {
      throw new Error("expected submission view")
    }

    expect(result.surveyId).toBe(surveyId)
    expect(result.respondentId).toBe(toWorkforceEmployeeId(1))
  })

  test("returns survey_not_found for a missing survey", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const result = await new SubmitSurveyResponse({ surveyRepository }).run({
      surveyId: 9999,
      respondentId: toWorkforceEmployeeId(1),
      answersJson: {},
      submittedAt: "2026-02-01T00:00:00.000Z",
    })

    expectApplicationError(result, NotFoundError, "survey_not_found")
  })

  test("returns survey_not_open for a closed survey", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const surveyId = surveyRepository.seedSurvey("closed")

    const result = await new SubmitSurveyResponse({ surveyRepository }).run({
      surveyId: surveyId,
      respondentId: toWorkforceEmployeeId(1),
      answersJson: {},
      submittedAt: "2026-02-01T00:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "survey_not_open")
  })

  test("returns already_submitted for a duplicate response", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const surveyId = surveyRepository.seedSurvey("open")

    surveyRepository.seedResponse(surveyId, toWorkforceEmployeeId(1))

    const result = await new SubmitSurveyResponse({ surveyRepository }).run({
      surveyId: surveyId,
      respondentId: toWorkforceEmployeeId(1),
      answersJson: {},
      submittedAt: "2026-02-01T00:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "already_submitted")
  })
})

describe("UpdateSurveyResponse", () => {
  test("updates the response content", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const surveyId = surveyRepository.seedSurvey("open")
    const responseId = surveyRepository.seedResponse(surveyId, toWorkforceEmployeeId(1))

    const result = await new UpdateSurveyResponse({ surveyRepository }).run({
      responseId: responseId,
      respondentId: toWorkforceEmployeeId(1),
      answersJson: { a: "updated" },
      submittedAt: "2026-03-01T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(SurveyResponse)

    if (result instanceof SurveyResponse === false) {
      throw new Error("expected SurveyResponse")
    }

    expect(result.submittedAt).toBe("2026-03-01T00:00:00.000Z")
  })

  test("returns response_not_found for a missing response", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const result = await new UpdateSurveyResponse({ surveyRepository }).run({
      responseId: 9999,
      respondentId: toWorkforceEmployeeId(1),
      answersJson: {},
      submittedAt: "2026-03-01T00:00:00.000Z",
    })

    expectApplicationError(result, NotFoundError, "response_not_found")
  })

  test("returns not_respondent when viewer is not the respondent", async () => {
    const surveyRepository = new FakeSurveyRepository()

    const surveyId = surveyRepository.seedSurvey("open")
    const responseId = surveyRepository.seedResponse(surveyId, toWorkforceEmployeeId(1))

    const result = await new UpdateSurveyResponse({ surveyRepository }).run({
      responseId: responseId,
      respondentId: toWorkforceEmployeeId(99),
      answersJson: {},
      submittedAt: "2026-03-01T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "not_respondent")
  })

  test("returns survey_not_open when survey is closed", async () => {
    const surveyRepository = new FakeSurveyRepository()

    // open で回答を登録してから closed に変更
    const surveyId = surveyRepository.seedSurvey("open")
    const responseId = surveyRepository.seedResponse(surveyId, toWorkforceEmployeeId(1))

    surveyRepository.closeSurvey(surveyId)

    const result = await new UpdateSurveyResponse({ surveyRepository }).run({
      responseId: responseId,
      respondentId: toWorkforceEmployeeId(1),
      answersJson: { a: "updated" },
      submittedAt: "2026-03-01T00:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "survey_not_open")
  })
})
