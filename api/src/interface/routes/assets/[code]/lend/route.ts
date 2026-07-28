import { LendAsset } from "@/application/asset/lend-asset"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppAsset } from "@/lib/app-schemas"
import { validateCodeParam } from "@/interface/utils/validate-code-param"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

/** POST /assets/:code/lend — 在庫中の資産を従業員へ貸し出す（権限が必要） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      employee_code: codeSchema,
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const updated = await new LendAsset(c).run({
      session: session,
      code: validateCodeParam(c.req.param("code"), "asset"),
      employeeCode: json.employee_code,
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
  },
)
