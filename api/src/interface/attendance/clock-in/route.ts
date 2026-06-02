import { ClockIn } from "@/application/attendance/clock-in"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"
import { zValidator } from "@hono/zod-validator"
import { ConflictError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { z } from "zod"

// POST /attendance/clock-in — 本人の出勤を打刻する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      note: z.string().nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const record = await new ClockIn(c).run({
      employeeId: session.employeeId,
      now: c.env.NOW ?? new Date().toISOString(),
      note: json.note ?? null,
    })

    if (record instanceof Error) {
      throw new InternalError("failed to clock in")
    }

    if ("reason" in record) {
      throw new ConflictError("already clocked in")
    }

    const responseBody = {
      id: record.id,
      employee_id: record.employeeId,
      work_date: record.workDate,
      clock_in_at: record.clockInAt,
      clock_out_at: record.clockOutAt,
      work_minutes: record.workMinutes,
      status: record.status,
    }

    return c.json(responseBody, 201)
  },
)
