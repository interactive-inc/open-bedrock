import { CreateResignation } from "@/application/resignation/create-resignation"
import { factory } from "@/interface/utils/factory"
import { isoDate } from "@/lib/schemas"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { ApplicationError, ValidationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { zAppResignation } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
export const POST = factory.createHandlers(
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

    const result = await new CreateResignation(c).run({
      employeeId: viewer.employeeId,
      resignationDate: json.resignation_date,
      lastWorkingDate: json.last_working_date ?? null,
      reason: json.reason ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (result instanceof ApplicationError) {
      throw toHttpException(result)
    }

    const responseBody = zAppResignation.parse({
      id: result.id,
      employee_id: result.employeeId,
      resignation_date: result.resignationDate,
      last_working_date: result.lastWorkingDate,
      reason: result.reason,
      status: result.status,
      created_at: result.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
