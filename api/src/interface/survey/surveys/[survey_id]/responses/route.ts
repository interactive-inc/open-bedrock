import { SubmitSurveyResponse } from "@/application/survey/submit-survey-response"
import { jsonPayloadSchema } from "@/interface/shared/json-payload-schema"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"
import {
  BadRequestError,
  ConflictError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

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

    const surveyId = validateIntParam(c.req.param("survey_id"), "survey")

    const json = c.req.valid("json")

    const submission = await new SubmitSurveyResponse(c).run({
      surveyId,
      respondentId: c.var.session.employeeId,
      answersJson: json.answers_json,
      submittedAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (submission instanceof Error) {
      throw new InternalError("failed to submit response")
    }

    if ("reason" in submission) {
      if (submission.reason === "survey_not_found") {
        throw new NotFoundError("survey not found")
      }

      if (submission.reason === "already_submitted") {
        throw new ConflictError("already submitted")
      }

      throw new BadRequestError("survey is not open")
    }

    const responseBody = {
      id: submission.id,
      survey_id: submission.surveyId,
      respondent_id: submission.respondentId,
      answers_json: submission.answersJson,
      submitted_at: submission.submittedAt,
    }

    return c.json(responseBody, 200)
  },
)
