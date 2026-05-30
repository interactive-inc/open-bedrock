import { ReturnAsset } from "@/application/asset/return-asset"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"

// POST /assets/:code/return — 貸出中の資産を在庫へ戻す（権限が必要）
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const updated = await new ReturnAsset(c).run({
    viewerRole: session.role,
    code: c.req.param("code") ?? "",
    now: c.env.NOW ?? new Date().toISOString(),
  })

  if (updated instanceof Error) {
    throw new InternalError("failed to return asset")
  }

  if ("reason" in updated) {
    if (updated.reason === "forbidden") {
      throw new ForbiddenError()
    }

    if (updated.reason === "asset_not_found") {
      throw new NotFoundError("asset not found")
    }

    throw new ConflictError("asset is not lent")
  }

  const responseBody = {
    code: updated.code,
    name: updated.name,
    kind: updated.kind,
    serial: updated.serial,
    purchased_on: updated.purchasedOn,
    status: updated.status,
    holder_employee_id: updated.holderEmployeeId,
  }

  return c.json(responseBody, 200)
})
