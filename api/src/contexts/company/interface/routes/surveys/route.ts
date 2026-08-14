import { Survey } from "@/domain/survey/survey.entity"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { zAppSurveyList } from "@/lib/app-schemas"
import { surveys } from "@/schema"
import { count, eq } from "drizzle-orm"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"

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
