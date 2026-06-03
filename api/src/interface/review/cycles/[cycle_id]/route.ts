import { DeleteReviewCycle } from "@/application/review/delete-review-cycle"
import { UpdateReviewCycle } from "@/application/review/update-review-cycle"
import { ReviewCycle } from "@/domain/review/review-cycle"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  BadRequestError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// PUT /review-cycles/:cycle_id — 管理者がサイクルの題目・期間・締切を更新
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1),
      period: z.string().min(1),
      dueDate: z.string().nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const cycleId = Number(c.req.param("cycle_id"))

    if (Number.isInteger(cycleId) === false) {
      throw new BadRequestError("invalid cycle id")
    }

    const json = c.req.valid("json")

    const updated = await new UpdateReviewCycle(c).run({
      viewerRole: session.role,
      cycleId,
      title: json.title,
      period: json.period,
      dueDate: json.dueDate ?? null,
    })

    if (updated instanceof Error) {
      throw new InternalError("failed to update review cycle")
    }

    if (updated instanceof ReviewCycle === false) {
      if (updated.reason === "forbidden") {
        throw new ForbiddenError()
      }

      throw new NotFoundError("review cycle not found")
    }

    const responseBody = {
      id: updated.id,
      title: updated.title,
      period: updated.period,
      status: updated.status,
      due_date: updated.dueDate,
    }

    return c.json(responseBody, 200)
  },
)

// DELETE /review-cycles/:cycle_id — 管理者がサイクルを削除
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const cycleId = Number(c.req.param("cycle_id"))

  if (Number.isInteger(cycleId) === false) {
    throw new BadRequestError("invalid cycle id")
  }

  const result = await new DeleteReviewCycle(c).run({
    viewerRole: session.role,
    cycleId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to delete review cycle")
  }

  if (result.reason === "forbidden") {
    throw new ForbiddenError()
  }

  if (result.reason === "cycle_not_found") {
    throw new NotFoundError("review cycle not found")
  }

  return c.body(null, 204)
})
