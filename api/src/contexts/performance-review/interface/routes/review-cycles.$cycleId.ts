import { DeleteReviewCycle } from "@/contexts/performance-review/application/review/delete-review-cycle"
import { UpdateReviewCycle } from "@/contexts/performance-review/application/review/update-review-cycle"
import { factory } from "@/api/http/factory"
import { isoDate } from "@/lib/schemas"
import { ApplicationError } from "@/lib/errors"
import { zAppReviewCycle } from "@/lib/app-schemas"
import { verifyBearer } from "@/api/http/verify-bearer"
import { toHttpException } from "@/lib/http/to-http-exception"
import { UnauthorizedError } from "@/lib/http/errors"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** PUT /review-cycles/:cycleId — 管理者がサイクルの題目・期間・締切を更新 */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(500),
      period: z.string().min(1).max(100),
      dueDate: isoDate.nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const cycleId = validateIntParam(c.req.param("cycleId"), "review cycle")

    const json = c.req.valid("json")

    const updated = await new UpdateReviewCycle(c).run({
      session: session,
      cycleId,
      title: json.title,
      period: json.period,
      dueDate: json.dueDate ?? null,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppReviewCycle.parse({
      id: updated.id,
      title: updated.title,
      period: updated.period,
      status: updated.status,
      due_date: updated.dueDate,
    })

    return c.json(responseBody, 200)
  },
)

// @authorization service - session を application service に渡して判定する
/** DELETE /review-cycles/:cycleId — 管理者がサイクルを削除 */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const cycleId = validateIntParam(c.req.param("cycleId"), "review cycle")

  const result = await new DeleteReviewCycle(c).run({
    session: session,
    cycleId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
