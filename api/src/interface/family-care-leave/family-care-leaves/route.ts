import { CreateFamilyCareLeave } from "@/application/family-care-leave/create-family-care-leave"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      leave_kind: z.string().min(1),
      start_date: isoDate,
      end_date: isoDate,
      note: z.string().nullable().optional(),
    }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const familyCareLeave = await new CreateFamilyCareLeave(c).run({
      employeeId: viewer.employeeId,
      leaveKind: json.leave_kind,
      startDate: json.start_date,
      endDate: json.end_date,
      note: json.note ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (familyCareLeave instanceof Error) {
      throw new InternalError("failed to create family care leave")
    }

    const responseBody = {
      id: familyCareLeave.id,
      employee_id: familyCareLeave.employeeId,
      leave_kind: familyCareLeave.leaveKind,
      start_date: familyCareLeave.startDate,
      end_date: familyCareLeave.endDate,
      note: familyCareLeave.note,
      status: familyCareLeave.status,
      created_at: familyCareLeave.createdAt,
    }

    return c.json(responseBody, 201)
  },
)
