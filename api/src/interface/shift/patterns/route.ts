import { canManageShift } from "@/domain/shift/can-manage-shift"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { shiftPatterns } from "@/schema"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (canManageShift(session.role) === false) {
    throw new ForbiddenError()
  }

  const rows = await c.var.database.select().from(shiftPatterns).orderBy(shiftPatterns.id)

  const responseBody = rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    start_time: row.startTime,
    end_time: row.endTime,
    break_minutes: row.breakMinutes,
  }))

  return c.json(responseBody, 200)
})
