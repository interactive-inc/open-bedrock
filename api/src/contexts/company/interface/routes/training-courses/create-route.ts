import { CreateTrainingCourse } from "@/contexts/company/application/training/create-training-course"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zAppTrainingCourse } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

// @authorization service - session を application service に渡して判定する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      code: codeSchema,
      title: z.string().min(1).max(500),
      category: z.string().min(1).max(200),
      description: z.string().max(3_000).optional(),
      duration_minutes: z.number().int().positive().optional(),
      is_required: z.boolean().optional(),
    }),
  ),
  async (c) => {
    const body = c.req.valid("json")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const created = await new CreateTrainingCourse(c).run({
      session: session,
      code: body.code,
      title: body.title,
      category: body.category,
      description: body.description ?? null,
      durationMinutes: body.duration_minutes ?? null,
      isRequired: body.is_required ?? false,
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppTrainingCourse.parse({
      id: created.id,
      code: created.code,
      title: created.title,
      description: created.description,
      duration_minutes: created.durationMinutes,
      category: created.category,
      is_required: created.isRequired,
      status: created.status,
    })

    return c.json(responseBody, 201)
  },
)
