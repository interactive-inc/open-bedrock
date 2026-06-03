import { DeleteSurvey } from "@/application/survey/delete-survey"
import { UpdateSurvey } from "@/application/survey/update-survey"
import { Survey } from "@/domain/survey/survey"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// アンケートをレスポンス用の snake_case に整形する。
function toResponseBody(survey: Survey) {
  return {
    id: survey.id,
    title: survey.title,
    status: survey.status,
    questions_json: survey.questionsJson,
  }
}

// PUT /surveys/:survey_id — アンケートの内容を変更（管理権限のみ）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1),
      status: z.enum(["open", "closed"]),
      questions_json: z.array(z.unknown()),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const surveyId = Number(c.req.param("survey_id"))

    if (Number.isInteger(surveyId) === false) {
      throw new NotFoundError("survey not found")
    }

    const body = c.req.valid("json")

    const updated = await new UpdateSurvey(c).run({
      viewerRole: session.role,
      surveyId: surveyId,
      title: body.title,
      status: body.status,
      questionsJson: body.questions_json,
    })

    if (updated instanceof Error) {
      throw new InternalError("failed to update survey")
    }

    if (updated instanceof Survey === false) {
      if (updated.reason === "survey_not_found") {
        throw new NotFoundError("survey not found")
      }

      throw new ForbiddenError()
    }

    return c.json(toResponseBody(updated), 200)
  },
)

// DELETE /surveys/:survey_id — アンケートを削除（管理権限のみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const surveyId = Number(c.req.param("survey_id"))

  if (Number.isInteger(surveyId) === false) {
    throw new NotFoundError("survey not found")
  }

  const result = await new DeleteSurvey(c).run({
    viewerRole: session.role,
    surveyId: surveyId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to delete survey")
  }

  if (result.reason === "survey_not_found") {
    throw new NotFoundError("survey not found")
  }

  if (result.reason === "forbidden") {
    throw new ForbiddenError()
  }

  return c.body(null, 204)
})
