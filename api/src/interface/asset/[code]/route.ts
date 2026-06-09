import { DeleteAsset } from "@/application/asset/delete-asset"
import { UpdateAsset } from "@/application/asset/update-asset"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { assets } from "@/schema"
import { eq } from "drizzle-orm"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const code = c.req.param("code") ?? ""

  const rows = await c.var.database.select().from(assets).where(eq(assets.code, code)).limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("asset not found")
  }

  const responseBody = {
    code: row.code,
    name: row.name,
    kind: row.kind,
    serial: row.serial,
    purchased_on: row.purchasedOn,
    status: row.status,
    holder_employee_id: row.holderEmployeeId,
  }

  return c.json(responseBody, 200)
})

// PUT /assets/:code — 資産の名称・種別・シリアル・購入日を更新（権限が必要）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(200),
      kind: z.enum(["pc", "monitor", "furniture", "other"]),
      serial: z.string().max(200).optional(),
      purchased_on: isoDate.optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const updated = await new UpdateAsset(c).run({
      viewerRole: session.role,
      code: c.req.param("code") ?? "",
      details: {
        name: json.name,
        kind: json.kind,
        serial: json.serial ?? null,
        purchasedOn: json.purchased_on ?? null,
      },
    })

    if (updated instanceof Error) {
      throw new InternalError("failed to update asset")
    }

    if ("reason" in updated) {
      if (updated.reason === "asset_not_found") {
        throw new NotFoundError("asset not found")
      }

      throw new ForbiddenError()
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
  },
)

// DELETE /assets/:code — 資産を削除（権限が必要、貸与中は拒否）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeleteAsset(c).run({
    viewerRole: session.role,
    code: c.req.param("code") ?? "",
  })

  if (result instanceof Error) {
    throw new InternalError("failed to delete asset")
  }

  if (result.reason === "asset_not_found") {
    throw new NotFoundError("asset not found")
  }

  if (result.reason === "forbidden") {
    throw new ForbiddenError()
  }

  if (result.reason === "asset_in_use") {
    throw new ConflictError("asset is currently lent")
  }

  return c.body(null, 204)
})
