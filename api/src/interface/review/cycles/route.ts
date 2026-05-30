import { toCycleStatus } from "@/domain/review/to-cycle-status"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { reviewCycles } from "@/schema"
import { asc } from "drizzle-orm"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const rows = await c.var.database.select().from(reviewCycles).orderBy(asc(reviewCycles.id))

  const body = rows.map((row) => ({
    id: row.id,
    title: row.title,
    period: row.period,
    status: toCycleStatus(row.status),
    due_date: row.dueDate,
  }))

  return c.json(body, 200)
})
