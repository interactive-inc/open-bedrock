import { GetSurveyResponse } from "@/application/survey/get-survey-response"
import { UpdateSurveyResponse } from "@/application/survey/update-survey-response"
import { WithdrawSurveyResponse } from "@/application/survey/withdraw-survey-response"
import type { SurveyResponse } from "@/domain/survey/survey-response"
import { factory } from "@/lib/factory"
import { jsonPayloadSchema } from "@/interface/shared/json-payload-schema"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 回答をレスポンス用の snake_case に整形する。
function toResponseBody(response: SurveyResponse) {
  return {
    id: response.id,
    survey_id: response.surveyId,
    respondent_id: response.respondentId,
    answers_json: response.answersJson,
    submitted_at: response.submittedAt,
  }
}

// パスパラメータの回答 id を数値に変換する。不正なら null。
function toResponseId(value: string): number | null {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

// GET /surveys/responses/:response_id — 回答の詳細（本人のみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const responseId = toResponseId(c.req.param("response_id") ?? "")

  if (responseId === null) {
    throw new BadRequestError("invalid response id")
  }

  const response = await new GetSurveyResponse(c).run({
    responseId,
    respondentId: viewer.employeeId,
  })

  if (response instanceof Error) {
    throw new InternalError("failed to load survey response")
  }

  if ("reason" in response) {
    if (response.reason === "response_not_found") {
      throw new NotFoundError("survey response not found")
    }

    throw new ForbiddenError("not the respondent")
  }

  return c.json(toResponseBody(response), 200)
})

// PUT /surveys/responses/:response_id — 回答内容を変更（本人のみ・公開中のみ）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator("json", z.object({ answers_json: jsonPayloadSchema(10_000) })),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const responseId = toResponseId(c.req.param("response_id") ?? "")

    if (responseId === null) {
      throw new BadRequestError("invalid response id")
    }

    const json = c.req.valid("json")

    const response = await new UpdateSurveyResponse(c).run({
      responseId,
      respondentId: viewer.employeeId,
      answersJson: json.answers_json,
      submittedAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (response instanceof Error) {
      throw new InternalError("failed to update survey response")
    }

    if ("reason" in response) {
      if (response.reason === "response_not_found") {
        throw new NotFoundError("survey response not found")
      }

      if (response.reason === "not_respondent") {
        throw new ForbiddenError("not the respondent")
      }

      throw new ConflictError("the survey is no longer open")
    }

    return c.json(toResponseBody(response), 200)
  },
)

// DELETE /surveys/responses/:response_id — 回答を取り下げ（本人のみ・公開中のみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const responseId = toResponseId(c.req.param("response_id") ?? "")

  if (responseId === null) {
    throw new BadRequestError("invalid response id")
  }

  const result = await new WithdrawSurveyResponse(c).run({
    responseId,
    respondentId: viewer.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to withdraw survey response")
  }

  if (result.reason === "response_not_found") {
    throw new NotFoundError("survey response not found")
  }

  if (result.reason === "not_respondent") {
    throw new ForbiddenError("not the respondent")
  }

  if (result.reason === "survey_not_open") {
    throw new ConflictError("the survey is no longer open")
  }

  return c.body(null, 204)
})
