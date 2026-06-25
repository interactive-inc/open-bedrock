import { ListMySurveyResponses } from "@/application/survey/list-my-survey-responses"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppSurveyResponseList } from "@/lib/app-schemas"
import { surveyResponses } from "@/schema"
import { count, eq } from "drizzle-orm"

// GET /surveys/responses/me — 回答者本人のアンケート回答一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
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

  const responses = await new ListMySurveyResponses(c).run({
    respondentId: viewer.employeeId,
    limit,
    offset,
  })

  if (responses instanceof ApplicationError) {
    throw toHttpException(responses)
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(surveyResponses)
    .where(eq(surveyResponses.respondentId, viewer.employeeId))

  const data = responses.map((response) => ({
    id: response.id,
    survey_id: response.surveyId,
    respondent_id: String(response.respondentId),
    answers_json: response.answersJson,
    submitted_at: response.submittedAt,
  }))

  const responseBody = zAppSurveyResponseList.parse({
    data,
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
