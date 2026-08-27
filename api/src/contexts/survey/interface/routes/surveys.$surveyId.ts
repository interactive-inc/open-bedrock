import { DeleteSurvey } from "@/contexts/survey/application/delete-survey"
import { UpdateSurvey } from "@/contexts/survey/application/update-survey"
import { Survey } from "@/contexts/survey/domain/entities/survey.entity"
import { surveyQuestionSchema } from "@/contexts/survey/domain/definitions/survey-question.definition"
import { factory } from "@/api/http/factory"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { verifyBearer } from "@/api/http/verify-bearer"
import { InternalError, NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppSurvey } from "@/lib/app-schemas"
import type { AppSurvey } from "@/lib/app-schemas"
import { surveys } from "@/contexts/survey/infrastructure/schema/survey"
import { zValidator } from "@hono/zod-validator"
import { eq } from "drizzle-orm"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/**
 * GET /surveys/:surveyId — 指定アンケートを取得（認証済みユーザー）
 * 管理ロール以外は open 状態のアンケートのみ閲覧可能。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const surveyId = validateIntParam(c.req.param("surveyId"), "survey")

  const rows = await c.var.database.select().from(surveys).where(eq(surveys.id, surveyId)).limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("survey not found")
  }

  if (row.status !== "open" && session.hasPermission("survey:manage") === false) {
    throw new NotFoundError("survey not found")
  }

  const survey = Survey.fromRow(row)

  if (survey instanceof Error) {
    throw new InternalError("internal server error")
  }

  return c.json(toResponseBody(survey), 200)
})

/** アンケートをレスポンス用の snake_case に整形する。永続化済みの前提で id は number に絞る。 */
function toResponseBody(survey: Survey): AppSurvey {
  if (survey.id === null) {
    throw new InternalError("survey id is missing")
  }

  return zAppSurvey.parse({
    id: survey.id,
    title: survey.title,
    status: survey.status,
    questions_json: survey.questionsJson,
  })
}

// @authorization service - session を application service に渡して判定する
/** PUT /surveys/:surveyId — アンケートの内容を変更（管理権限のみ） */
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

    const surveyId = validateIntParam(c.req.param("surveyId"), "survey")

    const body = c.req.valid("json")

    const updated = await new UpdateSurvey(c).run({
      session: session,
      surveyId: surveyId,
      title: body.title,
      status: body.status,
      questionsJson: body.questions_json,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    return c.json(toResponseBody(updated), 200)
  },
)

// @authorization service - session を application service に渡して判定する
/** DELETE /surveys/:surveyId — アンケートを削除（管理権限のみ） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const surveyId = validateIntParam(c.req.param("surveyId"), "survey")

  const result = await new DeleteSurvey(c).run({
    session: session,
    surveyId: surveyId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
