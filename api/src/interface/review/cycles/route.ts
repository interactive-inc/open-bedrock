import { canAdministerCycle } from "@/domain/review/can-administer-cycle"
import { toCycleStatus } from "@/domain/review/to-cycle-status"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { reviewCycles } from "@/schema"
import { asc, eq } from "drizzle-orm"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const isAdmin = canAdministerCycle(session.role)

  const query = c.var.database.select().from(reviewCycles)

  const rows = isAdmin
    ? await query.orderBy(asc(reviewCycles.id))
    : await query.where(eq(reviewCycles.status, "open")).orderBy(asc(reviewCycles.id))

  const body = rows.map((row) => ({
    id: row.id,
    title: row.title,
    period: row.period,
    status: toCycleStatus(row.status),
    due_date: row.dueDate,
  }))

  return c.json(body, 200)
})
