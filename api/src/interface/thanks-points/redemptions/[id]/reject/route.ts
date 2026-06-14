import { DecideRedemption } from "@/application/thanks-points/decide-redemption"
import { canDecideRedemption } from "@/lib/thanks-points/can-decide-redemption"
import { toPositiveInt } from "@/lib/thanks-points/to-positive-int"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"

// POST /thanks/redemptions/:id/reject — 交換申請を却下する（承認権限が必要）
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (canDecideRedemption(session.role) === false) {
    throw new ForbiddenError()
  }

  const redemptionId = toPositiveInt(c.req.param("id") ?? "")

  if (redemptionId === null) {
    throw new BadRequestError("invalid redemption id")
  }

  const result = await new DecideRedemption(c).run({
    redemptionId,
    deciderId: session.employeeId,
    action: "reject",
    decidedAt: c.env.NOW ?? new Date().toISOString(),
  })

  if (result instanceof Error) {
    throw new InternalError("failed to reject redemption")
  }

  if ("reason" in result) {
    if (result.reason === "redemption_not_found") {
      throw new NotFoundError("redemption not found")
    }

    if (result.reason === "already_decided") {
      throw new ConflictError("redemption already decided")
    }

    if (result.reason === "self_approval_forbidden") {
      throw new ForbiddenError("cannot reject own redemption")
    }

    throw new ConflictError("redemption cannot be rejected")
  }

  return c.json({ id: result.id, status: result.status }, 200)
})
