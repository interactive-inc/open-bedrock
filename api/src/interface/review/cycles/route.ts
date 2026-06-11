import { canAdministerCycle } from "@/domain/review/can-administer-cycle"
import { toCycleStatus } from "@/domain/review/to-cycle-status"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { reviewCycles } from "@/schema"
import { asc, count, eq } from "drizzle-orm"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const isAdmin = canAdministerCycle(session.role)

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

  const query = c.var.database.select().from(reviewCycles)

  const rows = isAdmin
    ? await query.orderBy(asc(reviewCycles.id)).limit(limit).offset(offset)
    : await query
        .where(eq(reviewCycles.status, "open"))
        .orderBy(asc(reviewCycles.id))
        .limit(limit)
        .offset(offset)

  const countQuery = c.var.database.select({ total: count() }).from(reviewCycles)

  const totalRows = isAdmin
    ? await countQuery
    : await countQuery.where(eq(reviewCycles.status, "open"))

  const body = rows.map((row) => ({
    id: row.id,
    title: row.title,
    period: row.period,
    status: toCycleStatus(row.status),
    due_date: row.dueDate,
  }))

  return c.json({ data: body, total: totalRows.at(0)?.total ?? 0 }, 200)
})
