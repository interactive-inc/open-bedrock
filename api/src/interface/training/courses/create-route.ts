import { CreateTrainingCourse } from "@/application/training/create-training-course"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

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
      viewerRole: session.role,
      code: body.code,
      title: body.title,
      category: body.category,
      description: body.description ?? null,
      durationMinutes: body.duration_minutes ?? null,
      isRequired: body.is_required ?? false,
    })

    if (created instanceof Error) {
      throw new InternalError("failed to create course")
    }

    if ("reason" in created) {
      if (created.reason === "forbidden") {
        throw new ForbiddenError()
      }

      throw new ConflictError("course code already exists")
    }

    const responseBody = {
      id: created.id,
      code: created.code,
      title: created.title,
      description: created.description,
      duration_minutes: created.durationMinutes,
      category: created.category,
      is_required: created.isRequired,
      status: created.status,
    }

    return c.json(responseBody, 201)
  },
)
