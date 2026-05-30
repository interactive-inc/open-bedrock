import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { trainingEnrollments } from "@/schema"
import { asc, eq } from "drizzle-orm"

// GET /training/enrollments/me — 本人の受講一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const rows = await c.var.database
    .select()
    .from(trainingEnrollments)
    .where(eq(trainingEnrollments.employeeId, session.employeeId))
    .orderBy(asc(trainingEnrollments.id))

  const responseBody = rows.map((row) => ({
    id: row.id,
    course_id: row.courseId,
    employee_id: row.employeeId,
    status: row.status,
    completed_at: row.completedAt,
    score: row.score,
    due_date: row.dueDate,
  }))

  return c.json(responseBody, 200)
})
