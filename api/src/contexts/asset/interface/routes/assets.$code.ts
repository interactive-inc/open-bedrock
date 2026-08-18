import { DeleteAsset } from "@/contexts/asset/application/delete-asset"
import { UpdateAsset } from "@/contexts/asset/application/update-asset"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { toAssetResponse } from "@/contexts/asset/interface/http/assets/to-asset-response"
import { isoDate } from "@/lib/schemas"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { assets } from "@/contexts/asset/infrastructure/schema/asset"
import { eq } from "drizzle-orm"
import { ApplicationError } from "@/lib/errors"
import {
  NotFoundError,
  UnauthorizedError,
} from "@/contexts/company-compatibility/interface/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { zAppAsset } from "@/lib/app-schemas"
import { validateCodeParam } from "@/contexts/company-compatibility/interface/utils/validate-code-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const code = validateCodeParam(c.req.param("code"), "asset")

  const rows = await c.var.database.select().from(assets).where(eq(assets.code, code)).limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("asset not found")
  }

  const responseBody = zAppAsset.parse(toAssetResponse(row, session))

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** PUT /assets/:code — 資産の名称・種別・シリアル・購入日を更新（権限が必要） */
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
      session: session,
      code: validateCodeParam(c.req.param("code"), "asset"),
      details: {
        name: json.name,
        kind: json.kind,
        serial: json.serial ?? null,
        purchasedOn: json.purchased_on ?? null,
      },
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppAsset.parse({
      code: updated.code,
      name: updated.name,
      kind: updated.kind,
      serial: updated.serial,
      purchased_on: updated.purchasedOn,
      status: updated.status,
      holder_employee_id: updated.holderEmployeeId,
    })

    return c.json(responseBody, 200)
  },
)

// @authorization service - session を application service に渡して判定する
/** DELETE /assets/:code — 資産を削除（権限が必要、貸与中は拒否） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeleteAsset(c).run({
    session: session,
    code: validateCodeParam(c.req.param("code"), "asset"),
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
