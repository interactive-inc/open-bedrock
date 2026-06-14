import { describe, expect, test } from "bun:test"
import { CreateSurvey } from "@/application/survey/create-survey"
import { DeleteSurvey } from "@/application/survey/delete-survey"
import { GetSurveyResponse } from "@/application/survey/get-survey-response"
import { ListMySurveyResponses } from "@/application/survey/list-my-survey-responses"
import { SubmitSurveyResponse } from "@/application/survey/submit-survey-response"
import { UpdateSurvey } from "@/application/survey/update-survey"
import { UpdateSurveyResponse } from "@/application/survey/update-survey-response"
import { WithdrawSurveyResponse } from "@/application/survey/withdraw-survey-response"
import { Survey } from "@/domain/survey/survey.entity"
import { SurveyResponse } from "@/domain/survey/survey-response.entity"
import type { Context } from "@/env"
import { SurveyRepository } from "@/infrastructure/survey/survey-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"

// --- seed helpers ---

async function seedSurvey(context: Context, status: "open" | "closed"): Promise<number> {
  const created = await new SurveyRepository(context).create(
    Survey.create({
      title: "Test Survey",
      status: status,
      questionsJson: [{ q: "How are you?" }],
    }),
  )

  if (created instanceof Error || created.id === null) {
    throw new Error("seed survey failed")
  }

  return created.id
}

async function seedResponse(
  context: Context,
  surveyId: number,
  respondentId: number,
): Promise<number> {
  const surveyRepository = new SurveyRepository(context)

  const created = await surveyRepository.createResponse(
    SurveyResponse.create({
      surveyId: surveyId,
      respondentId: respondentId,
      answersJson: { a: "fine" },
      submittedAt: "2026-01-01T00:00:00.000Z",
    }),
  )

  if (created instanceof Error || "reason" in created || created.id === null) {
    throw new Error("seed response failed")
  }

  return created.id
}

// --- CreateSurvey ---

describe("CreateSurvey", () => {
  test("creates a survey with admin role", async () => {
    const { context } = createTestContext()

    const result = await new CreateSurvey(context).run({
      viewerRole: "admin",
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
    const { context } = createTestContext()

    const result = await new CreateSurvey(context).run({
      viewerRole: "hr",
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
    const { context } = createTestContext()

    const result = await new CreateSurvey(context).run({
      viewerRole: "member",
      title: "Survey",
      status: "open",
      questionsJson: [],
    })

    if (result instanceof Survey || result instanceof Error) {
      throw new Error("expected forbidden")
    }

    expect(result.reason).toBe("forbidden")
  })
})

// --- DeleteSurvey ---

describe("DeleteSurvey", () => {
  test("deletes a closed survey", async () => {
    const { context } = createTestContext()

    const surveyId = await seedSurvey(context, "closed")

    const result = await new DeleteSurvey(context).run({
      viewerRole: "admin",
      surveyId: surveyId,
    })

    if (result instanceof Error) {
      throw new Error("expected tagged result")
    }

    expect(result.reason).toBe("deleted")
  })

  test("deletes a closed survey and its responses", async () => {
    const { context } = createTestContext()

    // open で回答を登録してから closed に変更して削除する
    const surveyId = await seedSurvey(context, "open")

    await seedResponse(context, surveyId, 1)

    const db = context.env.DB

    await db.prepare("UPDATE surveys SET status = 'closed' WHERE id = ?1").bind(surveyId).run()

    const result = await new DeleteSurvey(context).run({
      viewerRole: "admin",
      surveyId: surveyId,
    })

    if (result instanceof Error) {
      throw new Error("expected tagged result")
    }

    expect(result.reason).toBe("deleted")
  })

  test("returns not_deletable for an open survey", async () => {
    const { context } = createTestContext()

    const surveyId = await seedSurvey(context, "open")

    const result = await new DeleteSurvey(context).run({
      viewerRole: "admin",
      surveyId: surveyId,
    })

    if (result instanceof Error) {
      throw new Error("expected tagged result")
    }

    expect(result.reason).toBe("not_deletable")
  })

  test("returns survey_not_found for a missing survey", async () => {
    const { context } = createTestContext()

    const result = await new DeleteSurvey(context).run({
      viewerRole: "admin",
      surveyId: 9999,
    })

    if (result instanceof Error) {
      throw new Error("expected tagged result")
    }

    expect(result.reason).toBe("survey_not_found")
  })

  test("returns forbidden for member role", async () => {
    const { context } = createTestContext()

    const result = await new DeleteSurvey(context).run({
      viewerRole: "member",
      surveyId: 1,
    })

    if (result instanceof Error) {
      throw new Error("expected tagged result")
    }

    expect(result.reason).toBe("forbidden")
  })

  test("removes the survey and its responses from the database", async () => {
    const { context } = createTestContext()

    const surveyId = await seedSurvey(context, "open")

    await seedResponse(context, surveyId, 1)

    const db = context.env.DB

    await db.prepare("UPDATE surveys SET status = 'closed' WHERE id = ?1").bind(surveyId).run()

    const result = await new DeleteSurvey(context).run({
      viewerRole: "admin",
      surveyId: surveyId,
    })

    if (result instanceof Error) {
      throw new Error("expected tagged result")
    }

    expect(result.reason).toBe("deleted")

    const surveyRepository = new SurveyRepository(context)

    const survey = await surveyRepository.findById(surveyId)

    expect(survey).toBe(null)

    const responseCount = await surveyRepository.countResponsesBySurveyId(surveyId)

    expect(responseCount).toBe(0)
  })

  // D1 の json_extract('', '$') を使ったガード。
  // 親 DELETE が 0 行のとき malformed JSON エラーでバッチを中断し、
  // 後続の survey_responses 削除を防ぐ（レースコンディション対策）。
  // open のまま batch を直接実行し、回答が残ることを検証する。
  test("guard aborts batch so responses survive when survey delete matches no rows", async () => {
    const { context } = createTestContext()

    const surveyId = await seedSurvey(context, "open")

    await seedResponse(context, surveyId, 1)

    const db = context.env.DB

    // 修正後の DeleteSurvey と同一の 3 ステートメント列を直接実行する。
    // 親 DELETE は status != 'open' に一致せず 0 行になり、ガードで中断される。
    let aborted = false

    try {
      await db.batch([
        db.prepare("DELETE FROM surveys WHERE id = ?1 AND status != 'open'").bind(surveyId),
        db.prepare("SELECT CASE WHEN changes() = 0 THEN json_extract('', '$') ELSE 1 END AS ok"),
        db.prepare("DELETE FROM survey_responses WHERE survey_id = ?1").bind(surveyId),
      ])
    } catch (error) {
      aborted = error instanceof Error && error.message.includes("malformed JSON")
    }

    expect(aborted).toBe(true)

    const surveyRepository = new SurveyRepository(context)

    // アンケート本体も回答も残っている
    const survey = await surveyRepository.findById(surveyId)

    expect(survey).not.toBe(null)

    const responseCount = await surveyRepository.countResponsesBySurveyId(surveyId)

    expect(responseCount).toBe(1)
  })
})

// --- UpdateSurvey ---

describe("UpdateSurvey", () => {
  test("updates title and status without changing questions", async () => {
    const { context } = createTestContext()

    const surveyId = await seedSurvey(context, "open")

    const result = await new UpdateSurvey(context).run({
      viewerRole: "admin",
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
    const { context } = createTestContext()

    const surveyId = await seedSurvey(context, "open")

    const result = await new UpdateSurvey(context).run({
      viewerRole: "admin",
      surveyId: surveyId,
      title: "Test Survey",
      status: "open",
      questionsJson: [{ q: "New question" }],
    })

    expect(result).toBeInstanceOf(Survey)
  })

  test("returns questions_immutable when responses exist and questions changed", async () => {
    const { context } = createTestContext()

    const surveyId = await seedSurvey(context, "open")

    await seedResponse(context, surveyId, 1)

    const result = await new UpdateSurvey(context).run({
      viewerRole: "admin",
      surveyId: surveyId,
      title: "Test Survey",
      status: "open",
      questionsJson: [{ q: "Changed question" }],
    })

    if (result instanceof Survey || result instanceof Error) {
      throw new Error("expected questions_immutable")
    }

    expect(result.reason).toBe("questions_immutable")
  })

  test("returns survey_not_found for a missing survey", async () => {
    const { context } = createTestContext()

    const result = await new UpdateSurvey(context).run({
      viewerRole: "admin",
      surveyId: 9999,
      title: "Missing",
      status: "open",
      questionsJson: [],
    })

    if (result instanceof Survey || result instanceof Error) {
      throw new Error("expected survey_not_found")
    }

    expect(result.reason).toBe("survey_not_found")
  })

  test("returns forbidden for member role", async () => {
    const { context } = createTestContext()

    const result = await new UpdateSurvey(context).run({
      viewerRole: "member",
      surveyId: 1,
      title: "Survey",
      status: "open",
      questionsJson: [],
    })

    if (result instanceof Survey || result instanceof Error) {
      throw new Error("expected forbidden")
    }

    expect(result.reason).toBe("forbidden")
  })
})

// --- SubmitSurveyResponse ---

describe("SubmitSurveyResponse", () => {
  test("submits a response to an open survey", async () => {
    const { context } = createTestContext()

    const surveyId = await seedSurvey(context, "open")

    const result = await new SubmitSurveyResponse(context).run({
      surveyId: surveyId,
      respondentId: 1,
      answersJson: { a: "great" },
      submittedAt: "2026-02-01T00:00:00.000Z",
    })

    if (result instanceof Error || "reason" in result) {
      throw new Error("expected submission view")
    }

    expect(result.surveyId).toBe(surveyId)
    expect(result.respondentId).toBe(1)
  })

  test("returns survey_not_found for a missing survey", async () => {
    const { context } = createTestContext()

    const result = await new SubmitSurveyResponse(context).run({
      surveyId: 9999,
      respondentId: 1,
      answersJson: {},
      submittedAt: "2026-02-01T00:00:00.000Z",
    })

    if (result instanceof Error) {
      throw new Error("expected tagged result")
    }

    if (!("reason" in result)) {
      throw new Error("expected tagged result")
    }

    expect(result.reason).toBe("survey_not_found")
  })

  test("returns survey_not_open for a closed survey", async () => {
    const { context } = createTestContext()

    const surveyId = await seedSurvey(context, "closed")

    const result = await new SubmitSurveyResponse(context).run({
      surveyId: surveyId,
      respondentId: 1,
      answersJson: {},
      submittedAt: "2026-02-01T00:00:00.000Z",
    })

    if (result instanceof Error) {
      throw new Error("expected tagged result")
    }

    if (!("reason" in result)) {
      throw new Error("expected tagged result")
    }

    expect(result.reason).toBe("survey_not_open")
  })

  test("returns already_submitted for a duplicate response", async () => {
    const { context } = createTestContext()

    const surveyId = await seedSurvey(context, "open")

    await seedResponse(context, surveyId, 1)

    const result = await new SubmitSurveyResponse(context).run({
      surveyId: surveyId,
      respondentId: 1,
      answersJson: {},
      submittedAt: "2026-02-01T00:00:00.000Z",
    })

    if (result instanceof Error) {
      throw new Error("expected tagged result")
    }

    if (!("reason" in result)) {
      throw new Error("expected tagged result")
    }

    expect(result.reason).toBe("already_submitted")
  })
})

// --- GetSurveyResponse ---

describe("GetSurveyResponse", () => {
  test("returns the response for the respondent", async () => {
    const { context } = createTestContext()

    const surveyId = await seedSurvey(context, "open")
    const responseId = await seedResponse(context, surveyId, 1)

    const result = await new GetSurveyResponse(context).run({
      responseId: responseId,
      respondentId: 1,
    })

    expect(result).toBeInstanceOf(SurveyResponse)

    if (result instanceof SurveyResponse === false) {
      throw new Error("expected SurveyResponse")
    }

    expect(result.id).toBe(responseId)
  })

  test("returns response_not_found for a missing response", async () => {
    const { context } = createTestContext()

    const result = await new GetSurveyResponse(context).run({
      responseId: 9999,
      respondentId: 1,
    })

    if (result instanceof SurveyResponse || result instanceof Error) {
      throw new Error("expected response_not_found")
    }

    expect(result.reason).toBe("response_not_found")
  })

  test("returns not_respondent when viewer is not the respondent", async () => {
    const { context } = createTestContext()

    const surveyId = await seedSurvey(context, "open")
    const responseId = await seedResponse(context, surveyId, 1)

    const result = await new GetSurveyResponse(context).run({
      responseId: responseId,
      respondentId: 99,
    })

    if (result instanceof SurveyResponse || result instanceof Error) {
      throw new Error("expected not_respondent")
    }

    expect(result.reason).toBe("not_respondent")
  })
})

// --- ListMySurveyResponses ---

describe("ListMySurveyResponses", () => {
  test("returns responses for the respondent", async () => {
    const { context } = createTestContext()

    const surveyId = await seedSurvey(context, "open")

    await seedResponse(context, surveyId, 1)

    const result = await new ListMySurveyResponses(context).run({
      respondentId: 1,
      limit: 10,
      offset: 0,
    })

    if (result instanceof Error) {
      throw new Error("expected array")
    }

    expect(result.length).toBe(1)
  })

  test("returns empty array for a respondent with no responses", async () => {
    const { context } = createTestContext()

    const result = await new ListMySurveyResponses(context).run({
      respondentId: 999,
      limit: 10,
      offset: 0,
    })

    if (result instanceof Error) {
      throw new Error("expected array")
    }

    expect(result.length).toBe(0)
  })
})

// --- UpdateSurveyResponse ---

describe("UpdateSurveyResponse", () => {
  test("updates the response content", async () => {
    const { context } = createTestContext()

    const surveyId = await seedSurvey(context, "open")
    const responseId = await seedResponse(context, surveyId, 1)

    const result = await new UpdateSurveyResponse(context).run({
      responseId: responseId,
      respondentId: 1,
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
    const { context } = createTestContext()

    const result = await new UpdateSurveyResponse(context).run({
      responseId: 9999,
      respondentId: 1,
      answersJson: {},
      submittedAt: "2026-03-01T00:00:00.000Z",
    })

    if (result instanceof SurveyResponse || result instanceof Error) {
      throw new Error("expected response_not_found")
    }

    expect(result.reason).toBe("response_not_found")
  })

  test("returns not_respondent when viewer is not the respondent", async () => {
    const { context } = createTestContext()

    const surveyId = await seedSurvey(context, "open")
    const responseId = await seedResponse(context, surveyId, 1)

    const result = await new UpdateSurveyResponse(context).run({
      responseId: responseId,
      respondentId: 99,
      answersJson: {},
      submittedAt: "2026-03-01T00:00:00.000Z",
    })

    if (result instanceof SurveyResponse || result instanceof Error) {
      throw new Error("expected not_respondent")
    }

    expect(result.reason).toBe("not_respondent")
  })

  test("returns survey_not_open when survey is closed", async () => {
    const { context } = createTestContext()

    // open で回答を登録してから closed に変更
    const surveyId = await seedSurvey(context, "open")
    const responseId = await seedResponse(context, surveyId, 1)
    const db = context.env.DB

    await db.prepare("UPDATE surveys SET status = 'closed' WHERE id = ?1").bind(surveyId).run()

    const result = await new UpdateSurveyResponse(context).run({
      responseId: responseId,
      respondentId: 1,
      answersJson: { a: "updated" },
      submittedAt: "2026-03-01T00:00:00.000Z",
    })

    if (result instanceof SurveyResponse || result instanceof Error) {
      throw new Error("expected survey_not_open")
    }

    expect(result.reason).toBe("survey_not_open")
  })
})

// --- WithdrawSurveyResponse ---

describe("WithdrawSurveyResponse", () => {
  test("withdraws a response from an open survey", async () => {
    const { context } = createTestContext()

    const surveyId = await seedSurvey(context, "open")
    const responseId = await seedResponse(context, surveyId, 1)

    const result = await new WithdrawSurveyResponse(context).run({
      responseId: responseId,
      respondentId: 1,
    })

    if (result instanceof Error) {
      throw new Error("expected tagged result")
    }

    expect(result.reason).toBe("withdrawn")
  })

  test("returns response_not_found for a missing response", async () => {
    const { context } = createTestContext()

    const result = await new WithdrawSurveyResponse(context).run({
      responseId: 9999,
      respondentId: 1,
    })

    if (result instanceof Error) {
      throw new Error("expected tagged result")
    }

    expect(result.reason).toBe("response_not_found")
  })

  test("returns not_respondent when viewer is not the respondent", async () => {
    const { context } = createTestContext()

    const surveyId = await seedSurvey(context, "open")
    const responseId = await seedResponse(context, surveyId, 1)

    const result = await new WithdrawSurveyResponse(context).run({
      responseId: responseId,
      respondentId: 99,
    })

    if (result instanceof Error) {
      throw new Error("expected tagged result")
    }

    expect(result.reason).toBe("not_respondent")
  })

  test("returns survey_not_open when survey is closed", async () => {
    const { context } = createTestContext()

    // open で回答を登録してから closed に変更
    const surveyId = await seedSurvey(context, "open")
    const responseId = await seedResponse(context, surveyId, 1)
    const db = context.env.DB

    await db.prepare("UPDATE surveys SET status = 'closed' WHERE id = ?1").bind(surveyId).run()

    const result = await new WithdrawSurveyResponse(context).run({
      responseId: responseId,
      respondentId: 1,
    })

    if (result instanceof Error) {
      throw new Error("expected tagged result")
    }

    expect(result.reason).toBe("survey_not_open")
  })
})
