import { LendAsset } from "@/application/asset/lend-asset"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

// POST /assets/:code/lend — 在庫中の資産を従業員へ貸し出す（権限が必要）
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
      viewerRole: session.role,
      code: c.req.param("code") ?? "",
      employeeCode: json.employee_code,
      now: c.env.NOW ?? new Date().toISOString(),
    })

    if (updated instanceof Error) {
      throw new InternalError("failed to lend asset")
    }

    if ("reason" in updated) {
      if (updated.reason === "forbidden") {
        throw new ForbiddenError()
      }

      if (updated.reason === "asset_not_found") {
        throw new NotFoundError("asset not found")
      }

      if (updated.reason === "employee_not_found") {
        throw new NotFoundError("employee not found")
      }

      throw new ConflictError("asset is not in stock")
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
