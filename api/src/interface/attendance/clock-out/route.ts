import { ClockOut } from "@/application/attendance/clock-out"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"
import {
  ConflictError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"

// POST /attendance/clock-out — 本人の退勤を打刻し労働時間を確定する
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const record = await new ClockOut(c).run({
    employeeId: session.employeeId,
    now: c.env.NOW ?? new Date().toISOString(),
  })

  if (record instanceof Error) {
    throw new InternalError("failed to clock out")
  }

  if ("reason" in record) {
    if (record.reason === "not_clocked_in") {
      throw new ConflictError("not clocked in")
    }

    throw new NotFoundError("attendance not found")
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

  return c.json(responseBody, 200)
})
