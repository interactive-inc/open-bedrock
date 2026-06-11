import { DeleteSurvey } from "@/application/survey/delete-survey"
import { UpdateSurvey } from "@/application/survey/update-survey"
import { canManageSurveys } from "@/domain/survey/can-manage-surveys"
import { Survey } from "@/domain/survey/survey"
import { surveyQuestionSchema } from "@/domain/survey/survey-question"
import { factory } from "@/lib/factory"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { surveys } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { eq } from "drizzle-orm"
import { z } from "zod"

// GET /surveys/:survey_id — 指定アンケートを取得（認証済みユーザー）
// 管理ロール以外は open 状態のアンケートのみ閲覧可能。
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const surveyId = validateIntParam(c.req.param("survey_id"), "survey")

  const rows = await c.var.database.select().from(surveys).where(eq(surveys.id, surveyId)).limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("survey not found")
  }

  if (row.status !== "open" && canManageSurveys(session.role) === false) {
    throw new NotFoundError("survey not found")
  }

  const survey = Survey.fromRow(row)

  if (survey instanceof Error) {
    throw new InternalError(survey.message)
  }

  return c.json(toResponseBody(survey), 200)
})

// アンケートをレスポンス用の snake_case に整形する。永続化済みの前提で id は number に絞る。
function toResponseBody(survey: Survey) {
  if (survey.id === null) {
    throw new InternalError("survey id is missing")
  }

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
      title: z.string().min(1).max(500),
      status: z.enum(["open", "closed"]),
      questions_json: z.array(surveyQuestionSchema).max(100),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const surveyId = validateIntParam(c.req.param("survey_id"), "survey")

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

      if (updated.reason === "questions_immutable") {
        throw new ConflictError("questions not modifiable when responses exist")
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

  const surveyId = validateIntParam(c.req.param("survey_id"), "survey")

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

  if (result.reason === "not_deletable") {
    throw new ConflictError("open survey cannot be deleted")
  }

  if (result.reason === "not_found") {
    throw new ConflictError("survey was modified concurrently")
  }

  return c.body(null, 204)
})
