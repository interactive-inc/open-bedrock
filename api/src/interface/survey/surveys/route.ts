import { Survey } from "@/domain/survey/survey"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { surveys } from "@/schema"
import { eq } from "drizzle-orm"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  if (c.var.session === null) {
    throw new UnauthorizedError()
  }
  const rows = await c.var.database
    .select()
    .from(surveys)
    .where(eq(surveys.status, "open"))
    .orderBy(surveys.id)
  const responseBody = rows.map((row) => {
    const survey = Survey.fromRow(row)
    if (survey instanceof Error) {
      throw new InternalError(survey.message)
    }
    return {
      id: survey.id,
      title: survey.title,
      status: survey.status,
      questions_json: survey.questionsJson,
    }
  })
  return c.json(responseBody, 200)
})
