import { CancelResignation } from "@/application/resignation/cancel-resignation"
import { GetResignation } from "@/application/resignation/get-resignation"
import { UpdateResignation } from "@/application/resignation/update-resignation"
import type { Resignation } from "@/domain/resignation/resignation.entity"
import { factory } from "@/interface/utils/factory"
import { isoDate } from "@/lib/schemas"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { ApplicationError, ValidationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppResignation } from "@/lib/app-schemas"
import { validateUuidParam } from "@/interface/utils/validate-uuid-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** 退職申請をレスポンス用の snake_case に整形し、スキーマで検証する。 */
function toResponseBody(resignation: Resignation) {
  return zAppResignation.parse({
    id: resignation.id,
    employee_id: resignation.employeeId,
    resignation_date: resignation.resignationDate,
    last_working_date: resignation.lastWorkingDate,
    reason: resignation.reason,
    status: resignation.status,
    created_at: resignation.createdAt,
  })
}

/** GET /resignations/:id — 退職申請の詳細（本人のみ） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const resignation = await new GetResignation(c).run({
    resignationId: validateUuidParam(c.req.param("id"), "resignation"),
    employeeId: viewer.employeeId,
  })

  if (resignation instanceof ApplicationError) {
    throw toHttpException(resignation)
  }

  return c.json(toResponseBody(resignation), 200)
})

/** PUT /resignations/:id — 退職申請の内容を変更（本人のみ） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({
        resignation_date: isoDate,
        last_working_date: isoDate.nullable().optional(),
        reason: z.string().min(1).max(3_000).nullable().optional(),
      })
      .refine(
        (data) => data.last_working_date == null || data.last_working_date <= data.resignation_date,
        {
          message: "last_working_date must be on or before resignation_date",
          path: ["last_working_date"],
        },
      ),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const today = (c.env.NOW ?? new Date().toISOString()).slice(0, 10)

    if (json.resignation_date < today) {
      throw toHttpException(
        new ValidationError("resignation_date must be today or in the future", "start_in_past"),
      )
    }

    const resignation = await new UpdateResignation(c).run({
      resignationId: validateUuidParam(c.req.param("id"), "resignation"),
      employeeId: viewer.employeeId,
      resignationDate: json.resignation_date,
      lastWorkingDate: json.last_working_date ?? null,
      reason: json.reason ?? null,
    })

    if (resignation instanceof ApplicationError) {
      throw toHttpException(resignation)
    }

    return c.json(toResponseBody(resignation), 200)
  },
)

/** DELETE /resignations/:id — 退職申請を取消（本人のみ） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const result = await new CancelResignation(c).run({
    resignationId: validateUuidParam(c.req.param("id"), "resignation"),
    employeeId: viewer.employeeId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
