import { UpdateLicense } from "@/application/license/update-license"
import type { License } from "@/domain/license/license.entity"
import { factory } from "@/lib/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppLicense } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// ライセンスをレスポンス用スキーマで検証する。
function toResponseBody(license: License) {
  return zAppLicense.parse({
    id: license.id,
    name: license.name,
    vendor: license.vendor,
    category: license.category,
    seats: license.seats,
    renewal_deadline: license.renewalDeadline,
    owner_employee_id: license.ownerEmployeeId,
    note: license.note,
    status: license.status,
    created_at: license.createdAt,
  })
}

// PUT /licenses/:id — ライセンス台帳の属性を更新（license:manage）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(300),
      vendor: z.string().max(300).nullable().optional(),
      category: z.enum(["saas", "software", "other"]).nullable().optional(),
      seats: z.number().int().nonnegative().nullable().optional(),
      renewal_deadline: isoDate.nullable().optional(),
      owner_employee_id: z.number().int().positive().nullable().optional(),
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const updated = await new UpdateLicense(c).run({
      session,
      id: validateIntParam(c.req.param("id"), "license"),
      details: {
        name: json.name,
        vendor: json.vendor ?? null,
        category: json.category ?? null,
        seats: json.seats ?? null,
        renewalDeadline: json.renewal_deadline ?? null,
        ownerEmployeeId: json.owner_employee_id ?? null,
        note: json.note ?? null,
      },
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    return c.json(toResponseBody(updated), 200)
  },
)
