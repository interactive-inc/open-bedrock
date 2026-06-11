import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { trainingEnrollments } from "@/schema"
import { asc, count, eq } from "drizzle-orm"

// GET /training/enrollments/me — 本人の受講一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
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
    .from(trainingEnrollments)
    .where(eq(trainingEnrollments.employeeId, session.employeeId))
    .orderBy(asc(trainingEnrollments.id))
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(trainingEnrollments)
    .where(eq(trainingEnrollments.employeeId, session.employeeId))

  const responseBody = rows.map((row) => ({
    id: row.id,
    course_id: row.courseId,
    employee_id: row.employeeId,
    status: row.status,
    completed_at: row.completedAt,
    score: row.score,
    due_date: row.dueDate,
  }))

  return c.json({ data: responseBody, total: totalRows.at(0)?.total ?? 0 }, 200)
})
