import { ReturnAsset } from "@/contexts/asset/application/return-asset"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppAsset } from "@/lib/app-schemas"
import { validateCodeParam } from "@/lib/http/validate-code-param"

// @authorization service - session を application service に渡して判定する
/** POST /assets/:code/return — 貸出中の資産を在庫へ戻す（権限が必要） */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const updated = await new ReturnAsset(c).run({
    session: session,
    code: validateCodeParam(c.req.param("code"), "asset"),
    now: c.env.NOW ?? new Date().toISOString(),
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
})
