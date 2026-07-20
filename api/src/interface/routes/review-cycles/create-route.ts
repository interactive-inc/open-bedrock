import { CreateReviewCycle } from "@/application/review/create-review-cycle"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import { ApplicationError } from "@/lib/errors"
import { zAppReviewCycle } from "@/lib/app-schemas"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { zReviewCyclePolicy } from "@/domain/review/review-cycle-policy"

/** POST /review-cycles — 管理者が draft の評価サイクルを作成 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(500),
      period: z.string().min(1).max(100),
      dueDate: isoDate.optional(),
      policy: zReviewCyclePolicy.optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const cycle = await new CreateReviewCycle(c).run({
      session: session,
      title: json.title,
      period: json.period,
      dueDate: json.dueDate ?? null,
      policy: json.policy,
    })

    if (cycle instanceof ApplicationError) {
      throw toHttpException(cycle)
    }

    const responseBody = zAppReviewCycle.parse({
      id: cycle.id,
      title: cycle.title,
      period: cycle.period,
      status: cycle.status,
      due_date: cycle.dueDate,
    })

    return c.json(responseBody, 201)
  },
)
