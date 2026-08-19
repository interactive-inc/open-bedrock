import { GetSurveyResponse } from "@/contexts/survey/application/get-survey-response"
import { UpdateSurveyResponse } from "@/contexts/survey/application/update-survey-response"
import { WithdrawSurveyResponse } from "@/contexts/survey/application/withdraw-survey-response"
import type { SurveyResponse } from "@/contexts/survey/domain/survey-response.entity"
import { factory } from "@/contexts/company/interface/utils/factory"
import { jsonPayloadSchema } from "@/contexts/company/interface/utils/json-payload-schema"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { BadRequestError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
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

  const response = await new GetSurveyResponse(c).run({
    responseId,
    respondentId: viewer.employeeId,
  })

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

  const result = await new WithdrawSurveyResponse(c).run({
    responseId,
    respondentId: viewer.employeeId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
