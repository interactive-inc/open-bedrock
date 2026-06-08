import { CreateYearEndAdjustment } from "@/application/year-end-adjustment/create-year-end-adjustment"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      target_year: z.number().int(),
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const yearEndAdjustment = await new CreateYearEndAdjustment(c).run({
      employeeId: viewer.employeeId,
      targetYear: json.target_year,
      note: json.note ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (yearEndAdjustment instanceof Error) {
      throw new InternalError("failed to create year end adjustment")
    }

    const responseBody = {
      id: yearEndAdjustment.id,
      employee_id: yearEndAdjustment.employeeId,
      target_year: yearEndAdjustment.targetYear,
      note: yearEndAdjustment.note,
      status: yearEndAdjustment.status,
      created_at: yearEndAdjustment.createdAt,
    }

    return c.json(responseBody, 201)
  },
)
