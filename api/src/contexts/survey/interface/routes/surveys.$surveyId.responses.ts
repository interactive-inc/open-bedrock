import { SubmitSurveyResponse } from "@/contexts/survey/application/submit-survey-response"
import { jsonPayloadSchema } from "@/contexts/company-compatibility/interface/utils/json-payload-schema"
import { validateIntParam } from "@/contexts/company-compatibility/interface/utils/validate-int-param"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { zAppSurveyResponse } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      answers_json: jsonPayloadSchema(10_000),
    }),
  ),
  async (c) => {
    if (c.var.session === null) {
      throw new UnauthorizedError()
    }

    const surveyId = validateIntParam(c.req.param("surveyId"), "survey")

    const json = c.req.valid("json")

    const submission = await new SubmitSurveyResponse(c).run({
      surveyId,
      respondentId: c.var.session.employeeId,
      answersJson: json.answers_json,
      submittedAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (submission instanceof ApplicationError) {
      throw toHttpException(submission)
    }

    const responseBody = zAppSurveyResponse.parse({
      id: submission.id,
      survey_id: submission.surveyId,
      respondent_id: submission.respondentId,
      answers_json: submission.answersJson,
      submitted_at: submission.submittedAt,
    })

    return c.json(responseBody, 201)
  },
)
