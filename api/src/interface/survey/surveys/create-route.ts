import { CreateSurvey } from "@/application/survey/create-survey"
import { Survey } from "@/domain/survey/survey"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// POST /surveys — アンケートを作成（管理権限のみ）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1),
      status: z.enum(["open", "closed"]),
      questions_json: z.array(z.unknown()),
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

    if (survey instanceof Error) {
      throw new InternalError("failed to create survey")
    }

    if (survey instanceof Survey === false) {
      throw new ForbiddenError()
    }

    const responseBody = {
      id: survey.id,
      title: survey.title,
      status: survey.status,
      questions_json: survey.questionsJson,
    }

    return c.json(responseBody, 201)
  },
)
