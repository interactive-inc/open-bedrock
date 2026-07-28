import { DisposeAsset } from "@/application/asset/dispose-asset"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppAsset } from "@/lib/app-schemas"
import { isoDate } from "@/lib/schemas"
import { validateCodeParam } from "@/interface/utils/validate-code-param"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** POST /assets/:code/dispose — 在庫中の資産を廃棄済みにする（理由・日付を記録。権限が必要） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      reason: z.string().min(1).max(500),
      disposed_on: isoDate.optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const now = c.env.NOW ?? new Date().toISOString()

    const updated = await new DisposeAsset(c).run({
      session: session,
      code: validateCodeParam(c.req.param("code"), "asset"),
      reason: json.reason,
      disposedOn: json.disposed_on ?? now.slice(0, 10),
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
      disposed_on: updated.disposedOn,
      disposal_reason: updated.disposalReason,
    })

    return c.json(responseBody, 200)
  },
)
