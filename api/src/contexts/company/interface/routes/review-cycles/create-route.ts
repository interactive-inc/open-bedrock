import { CreateReviewCycle } from "@/contexts/company/application/review/create-review-cycle"
import { factory } from "@/contexts/company/interface/utils/factory"
import { isoDate } from "@/lib/schemas"
import { ApplicationError } from "@/lib/errors"
import { zAppReviewCycle } from "@/lib/app-schemas"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { zReviewCyclePolicy } from "@/contexts/company/domain/review/review-cycle-policy"

// @authorization service - session を application service に渡して判定する
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
