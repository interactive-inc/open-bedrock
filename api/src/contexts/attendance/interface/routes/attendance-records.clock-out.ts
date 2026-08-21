import { ClockOut } from "@/contexts/attendance/application/clock-out"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"
import { zValidator } from "@hono/zod-validator"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppAttendanceRecord } from "@/lib/app-schemas"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
/** POST /attendance-records/clock-out — 本人の退勤を打刻し労働時間を確定する */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const record = await new ClockOut(c).run({
      employeeId: session.employeeId,
      now: c.env.NOW ?? new Date().toISOString(),
      note: json.note === undefined ? undefined : (json.note ?? null),
    })

    if (record instanceof ApplicationError) {
      throw toHttpException(record)
    }

    const responseBody = zAppAttendanceRecord.parse({
      id: record.id,
      employee_id: record.employeeId,
      work_date: record.workDate,
      clock_in_at: record.clockInAt,
      clock_out_at: record.clockOutAt,
      work_minutes: record.workMinutes,
      status: record.status,
    })

    return c.json(responseBody, 200)
  },
)
