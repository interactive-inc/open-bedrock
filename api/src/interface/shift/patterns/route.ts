import { canManageShift } from "@/lib/shift/can-manage-shift"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { zAppShiftPatternList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { shiftPatterns } from "@/schema"
import { count } from "drizzle-orm"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (canManageShift(session) === false) {
    throw new ForbiddenError()
  }

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const rows = await c.var.database
    .select()
    .from(shiftPatterns)
    .orderBy(shiftPatterns.id)
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database.select({ total: count() }).from(shiftPatterns)

  const responseBody = zAppShiftPatternList.parse({
    data: rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      start_time: row.startTime,
      end_time: row.endTime,
      break_minutes: row.breakMinutes,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
