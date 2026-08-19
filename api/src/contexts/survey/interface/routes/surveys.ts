import { InternalError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { CreateSurvey } from "@/contexts/survey/application/create-survey"
import { surveyQuestionSchema } from "@/contexts/survey/domain/survey-question.value"
import { Survey } from "@/contexts/survey/domain/survey.entity"
import { surveys } from "@/contexts/survey/infrastructure/schema/survey"
import { zAppSurvey, zAppSurveyList } from "@/lib/app-schemas"
import { ApplicationError } from "@/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { count, eq } from "drizzle-orm"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** POST /surveys — アンケートを作成（管理権限のみ） */
export const POST = factory.createHandlers(
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

    const body = c.req.valid("json")

    const survey = await new CreateSurvey(c).run({
      session: session,
      title: body.title,
      status: body.status,
      questionsJson: body.questions_json,
    })

    if (survey instanceof ApplicationError) {
      throw toHttpException(survey)
    }

    const responseBody = zAppSurvey.parse({
      id: survey.id,
      title: survey.title,
      status: survey.status,
      questions_json: survey.questionsJson,
    })

    return c.json(responseBody, 201)
  },
)

// @authorization authenticated - ログインしていれば誰でも読める共有データ
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  if (c.var.session === null) {
    throw new UnauthorizedError()
  }

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const rows = await c.var.database
    .select()
    .from(surveys)
    .where(eq(surveys.status, "open"))
    .orderBy(surveys.id)
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(surveys)
    .where(eq(surveys.status, "open"))

  const data = rows.map((row) => {
    const survey = Survey.fromRow(row)

    if (survey instanceof Error) {
      throw new InternalError("internal server error")
    }

    return {
      id: row.id,
      title: survey.title,
      status: survey.status,
      questions_json: survey.questionsJson,
    }
  })

  const responseBody = zAppSurveyList.parse({ data, total: totalRows.at(0)?.total ?? 0 })

  return c.json(responseBody, 200)
})
