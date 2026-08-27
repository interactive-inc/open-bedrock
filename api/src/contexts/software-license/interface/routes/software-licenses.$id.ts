import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { UpdateLicense } from "@/contexts/software-license/application/license/update-license"
import type { License } from "@/contexts/software-license/domain/entities/license.entity"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppLicense } from "@/lib/app-schemas"
import { toHttpException } from "@/lib/http/to-http-exception"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** ライセンスをレスポンス用スキーマで検証する。 */
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

// @authorization service - session を application service に渡して判定する
/** PUT /software-licenses/:id — ライセンス台帳の属性を更新（license:manage） */
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
      owner_employee_id: zEmployeeId.nullable().optional(),
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
