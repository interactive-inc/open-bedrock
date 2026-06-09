import { CreateYearEndAdjustment } from "@/application/year-end-adjustment/create-year-end-adjustment"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { ConflictError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      target_year: z.number().int().min(2000).max(2100),
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const result = await new CreateYearEndAdjustment(c).run({
      employeeId: viewer.employeeId,
      targetYear: json.target_year,
      note: json.note ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (result instanceof Error) {
      throw new InternalError("failed to create year end adjustment")
    }

    if ("kind" in result) {
      throw new ConflictError("already submitted for this year")
    }

    const responseBody = {
      id: result.id,
      employee_id: result.employeeId,
      target_year: result.targetYear,
      note: result.note,
      status: result.status,
      created_at: result.createdAt,
    }

    return c.json(responseBody, 201)
  },
)
