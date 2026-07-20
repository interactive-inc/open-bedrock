import { toReviewCycleStatus } from "@/domain/review/review-cycle-status.value"
import { canAdministerCycle } from "@/lib/review/can-administer-cycle"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { zAppReviewCycleList } from "@/lib/app-schemas"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { reviewCycles } from "@/schema"
import { asc, count, eq } from "drizzle-orm"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const isAdmin = canAdministerCycle(session)

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

  const responseBody = zAppReviewCycleList.parse({
    data: rows.map((row) => ({
      id: row.id,
      title: row.title,
      period: row.period,
      status: toReviewCycleStatus(row.status),
      due_date: row.dueDate,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
