import { UpdatePartner } from "@/application/partner/update-partner"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppPartner } from "@/lib/app-schemas"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** PUT /partners/:id — 取引先の名称・分類・法人番号・備考を更新（partner:manage） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(200),
      category: z.enum(["customer", "supplier", "other"]).optional(),
      corporate_number: z.string().max(200).optional(),
      note: z.string().max(3_000).optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const updated = await new UpdatePartner(c).run({
      session: session,
      id: validateIntParam(c.req.param("id"), "partner"),
      details: {
        name: json.name,
        category: json.category ?? null,
        corporateNumber: json.corporate_number ?? null,
        note: json.note ?? null,
      },
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppPartner.parse({
      id: updated.id,
      code: updated.code,
      name: updated.name,
      category: updated.category,
      corporate_number: updated.corporateNumber,
      note: updated.note,
      status: updated.status,
      created_at: updated.createdAt,
    })

    return c.json(responseBody, 200)
  },
)
