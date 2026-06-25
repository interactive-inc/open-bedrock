import { CreateSurvey } from "@/application/survey/create-survey"
import { surveyQuestionSchema } from "@/domain/survey/survey-question.value"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppSurvey } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// POST /surveys — アンケートを作成（管理権限のみ）
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
      viewerRole: session.role,
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
