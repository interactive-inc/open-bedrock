import {
  ForbiddenError,
  UnauthorizedError,
} from "@/contexts/company-compatibility/interface/lib/errors"
import { zAppShiftPatternList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company-compatibility/interface/utils/to-bounded-int"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { shiftPatterns } from "@/contexts/shift/infrastructure/schema/shift"
import { count } from "drizzle-orm"

// @authorization permission - 権限キーで判定する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("shift:manage") === false) {
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
