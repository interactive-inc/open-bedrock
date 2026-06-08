import { CreateReviewCycle } from "@/application/review/create-review-cycle"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// POST /review-cycles — 管理者が draft の評価サイクルを作成
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(500),
      period: z.string().min(1).max(100),
      dueDate: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const cycle = await new CreateReviewCycle(c).run({
      viewerRole: session.role,
      title: json.title,
      period: json.period,
      dueDate: json.dueDate ?? null,
    })

    if (cycle instanceof Error) {
      throw new InternalError("failed to create review cycle")
    }

    if ("reason" in cycle) {
      throw new ForbiddenError()
    }

    const responseBody = {
      id: cycle.id,
      title: cycle.title,
      period: cycle.period,
      status: cycle.status,
      due_date: cycle.dueDate,
    }

    return c.json(responseBody, 201)
  },
)
