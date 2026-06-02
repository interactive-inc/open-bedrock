import { ListMySurveyResponses } from "@/application/survey/list-my-survey-responses"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"

// GET /surveys/responses/me — 回答者本人のアンケート回答一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const responses = await new ListMySurveyResponses(c).run({
    respondentId: viewer.employeeId,
  })

  if (responses instanceof Error) {
    throw new InternalError("failed to load survey responses")
  }

  const responseBody = responses.map((response) => ({
    id: response.id,
    survey_id: response.surveyId,
    respondent_id: response.respondentId,
    answers_json: response.answersJson,
    submitted_at: response.submittedAt,
  }))

  return c.json(responseBody, 200)
})
