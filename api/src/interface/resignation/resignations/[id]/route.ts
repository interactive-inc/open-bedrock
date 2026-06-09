import { CancelResignation } from "@/application/resignation/cancel-resignation"
import { GetResignation } from "@/application/resignation/get-resignation"
import { UpdateResignation } from "@/application/resignation/update-resignation"
import { Resignation } from "@/domain/resignation/resignation"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 退職申請をレスポンス用の snake_case に整形する。
function toResponseBody(resignation: Resignation) {
  return {
    id: resignation.id,
    employee_id: resignation.employeeId,
    resignation_date: resignation.resignationDate,
    last_working_date: resignation.lastWorkingDate,
    reason: resignation.reason,
    status: resignation.status,
    created_at: resignation.createdAt,
  }
}

// GET /resignations/:id — 退職申請の詳細（本人のみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const resignation = await new GetResignation(c).run({
    resignationId: c.req.param("id") ?? "",
    employeeId: viewer.employeeId,
  })

  if (resignation instanceof Error) {
    throw new InternalError("failed to load resignation")
  }

  if (resignation instanceof Resignation === false) {
    if (resignation.reason === "resignation_not_found") {
      throw new NotFoundError("resignation not found")
    }

    throw new ForbiddenError("not the applicant")
  }

  return c.json(toResponseBody(resignation), 200)
})

// PUT /resignations/:id — 退職申請の内容を変更（本人のみ）
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

    const resignation = await new UpdateResignation(c).run({
      resignationId: c.req.param("id") ?? "",
      employeeId: viewer.employeeId,
      resignationDate: json.resignation_date,
      lastWorkingDate: json.last_working_date ?? null,
      reason: json.reason ?? null,
    })

    if (resignation instanceof Error) {
      throw new InternalError("failed to update resignation")
    }

    if (resignation instanceof Resignation === false) {
      if (resignation.reason === "resignation_not_found") {
        throw new NotFoundError("resignation not found")
      }

      throw new ForbiddenError("not the applicant")
    }

    return c.json(toResponseBody(resignation), 200)
  },
)

// DELETE /resignations/:id — 退職申請を取消（本人のみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const result = await new CancelResignation(c).run({
    resignationId: c.req.param("id") ?? "",
    employeeId: viewer.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to cancel resignation")
  }

  if (result.reason === "resignation_not_found") {
    throw new NotFoundError("resignation not found")
  }

  if (result.reason === "not_applicant") {
    throw new ForbiddenError("not the applicant")
  }

  return c.body(null, 204)
})
