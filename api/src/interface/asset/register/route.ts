import { RegisterAsset } from "@/application/asset/register-asset"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppAsset } from "@/lib/app-schemas"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

// POST /assets — 新規資産の登録（権限が必要）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      code: codeSchema,
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

    const created = await new RegisterAsset(c).run({
      viewerRole: session.role,
      asset: {
        code: json.code,
        name: json.name,
        kind: json.kind,
        serial: json.serial ?? null,
        purchasedOn: json.purchased_on ?? null,
      },
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppAsset.parse({
      code: created.code,
      name: created.name,
      kind: created.kind,
      serial: created.serial,
      purchased_on: created.purchasedOn,
      status: created.status,
      holder_employee_id: created.holderEmployeeId,
    })

    return c.json(responseBody, 201)
  },
)
