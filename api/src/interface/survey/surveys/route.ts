import { Survey } from "@/domain/survey/survey"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { surveys } from "@/schema"
import { eq } from "drizzle-orm"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"

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
  const responseBody = rows.map((row) => {
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
  return c.json(responseBody, 200)
})
