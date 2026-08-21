import { SubmitSurveyResponse } from "@/contexts/survey/application/submit-survey-response"
import { jsonPayloadSchema } from "@/lib/http/json-payload-schema"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"
import { UnauthorizedError } from "@/lib/http/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
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
