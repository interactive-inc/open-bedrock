import { ConflictError } from "@/lib/errors"
import { SurveyRepository } from "@/contexts/survey/infrastructure/repositories/survey.repository"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"

import { UpdateSurveyResponse } from "@/contexts/survey/application/update-survey-response"
import type { SurveyResponse } from "@/contexts/survey/domain/entities/survey-response.entity"
import { factory } from "@/api/http/factory"
import { jsonPayloadSchema } from "@/lib/http/json-payload-schema"
import { verifyBearer } from "@/api/http/verify-bearer"
import { BadRequestError, UnauthorizedError } from "@/lib/http/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppSurveyResponse } from "@/lib/app-schemas"
import type { AppSurveyResponse } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** 回答をレスポンス用の snake_case に整形する。 */
function toResponseBody(response: SurveyResponse): AppSurveyResponse {
  return zAppSurveyResponse.parse({
    id: response.id,
    survey_id: response.surveyId,
    respondent_id: response.respondentId,
    answers_json: response.answersJson,
    submitted_at: response.submittedAt,
  })
}

/** パスパラメータの回答 id を数値に変換する。不正なら null。 */
function toResponseId(value: string): number | null {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

// @authorization owner - 本人のリソースに限定する
/** GET /surveys/responses/:responseId — 回答の詳細（本人のみ） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const responseId = toResponseId(c.req.param("responseId") ?? "")

  if (responseId === null) {
    throw new BadRequestError("invalid response id")
  }

  const response = await (async () => {
    const command = {
      responseId,
      respondentId: viewer.employeeId,
    }

    const surveyRepository = new SurveyRepository(c)

    const response = await surveyRepository.findResponseById(command.responseId)

    if (response instanceof Error) {
      return new UnexpectedError("failed to find survey response", { cause: response })
    }

    if (response === null) {
      return new NotFoundError("survey response not found", "response_not_found")
    }

    if (response.respondentId !== command.respondentId) {
      return new ForbiddenError("not the respondent", "not_respondent")
    }

    return response
  })()

  if (response instanceof ApplicationError) {
    throw toHttpException(response)
  }

  return c.json(toResponseBody(response), 200)
})

// @authorization owner - 本人のリソースに限定する
/** PUT /surveys/responses/:responseId — 回答内容を変更（本人のみ・公開中のみ） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator("json", z.object({ answers_json: jsonPayloadSchema(10_000) })),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const responseId = toResponseId(c.req.param("responseId") ?? "")

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

    if (response instanceof ApplicationError) {
      throw toHttpException(response)
    }

    return c.json(toResponseBody(response), 200)
  },
)

// @authorization owner - 本人のリソースに限定する
/** DELETE /surveys/responses/:responseId — 回答を取り下げ（本人のみ・公開中のみ） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const responseId = toResponseId(c.req.param("responseId") ?? "")

  if (responseId === null) {
    throw new BadRequestError("invalid response id")
  }

  const result = await (async () => {
    const command = {
      responseId,
      respondentId: viewer.employeeId,
    }

    const surveyRepository = new SurveyRepository(c)

    const current = await surveyRepository.findResponseById(command.responseId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find survey response", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("survey response not found", "response_not_found")
    }

    if (current.respondentId !== command.respondentId) {
      return new ForbiddenError("not the respondent", "not_respondent")
    }

    const survey = await surveyRepository.findById(current.surveyId)

    if (survey instanceof Error) {
      return new UnexpectedError("failed to find survey", { cause: survey })
    }

    if (survey === null || survey.isOpen() === false) {
      return new ConflictError("survey is not open", "survey_not_open")
    }

    const deleted = await surveyRepository.deleteResponse(command.responseId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete survey response", { cause: deleted })
    }

    if (deleted === null) {
      return new NotFoundError("survey response not found", "response_not_found")
    }

    if (deleted !== true && "reason" in deleted) {
      return new ConflictError("survey is not open", "survey_not_open")
    }

    return { reason: "withdrawn" }
  })()

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
