import { ListMySurveyResponses } from "@/contexts/survey/application/list-my-survey-responses"
import { factory } from "@/contexts/company/interface/utils/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAppSurveyResponseList } from "@/lib/app-schemas"
import { surveyResponses } from "@/contexts/survey/infrastructure/schema/survey"
import { count, eq } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
/** GET /surveys/responses/me — 回答者本人のアンケート回答一覧 */
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
    respondent_id: response.respondentId,
    answers_json: response.answersJson,
    submitted_at: response.submittedAt,
  }))

  const responseBody = zAppSurveyResponseList.parse({
    data,
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
