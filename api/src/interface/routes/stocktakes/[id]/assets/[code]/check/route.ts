import { CheckStocktakeItem } from "@/application/stocktake/check-stocktake-item"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { validateCodeParam } from "@/interface/utils/validate-code-param"
import { validateUuidParam } from "@/interface/utils/validate-uuid-param"
import { z } from "zod"

/** POST /stocktakes/:id/assets/:code/check — 資産の現物確認を記録（確認者・所在メモ。権限が必要） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      location_note: z.string().max(500).optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const result = await new CheckStocktakeItem(c).run({
      session: session,
      stocktakeId: validateUuidParam(c.req.param("id"), "stocktake"),
      assetCode: validateCodeParam(c.req.param("code"), "asset"),
      checkerEmployeeId: session.employeeId,
      locationNote: json.location_note ?? null,
      now: c.env.NOW ?? new Date().toISOString(),
    })

    if (result instanceof ApplicationError) {
      throw toHttpException(result)
    }

    return c.json({ status: "checked" }, 200)
  },
)
