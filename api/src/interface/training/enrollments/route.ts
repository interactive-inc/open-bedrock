import { canManageTraining } from "@/domain/training/can-manage-training"
import type { Variables } from "@/env"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { employees, trainingEnrollments } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { asc, eq } from "drizzle-orm"
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { z } from "zod"

// GET /training/enrollments — 受講状況を一覧する（管理権限で他者の指定が可能）
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({ employee_id: z.string().optional(), employee_code: z.string().optional() }),
  ),
  async (c) => {
    const query = c.req.valid("query")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const requestsOthers = query.employee_id !== undefined || query.employee_code !== undefined

    if (requestsOthers === true && canManageTraining(session.role) === false) {
      throw new ForbiddenError()
    }

    const targetEmployeeId = await resolveTargetEmployeeId(
      c.var.database,
      query,
      session.employeeId,
    )

    if (targetEmployeeId === null) {
      throw new NotFoundError("employee not found")
    }

    const rows = await c.var.database
      .select()
      .from(trainingEnrollments)
      .where(eq(trainingEnrollments.employeeId, targetEmployeeId))
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
  },
)

async function resolveTargetEmployeeId(
  database: Variables["database"],
  query: { employee_id?: string; employee_code?: string },
  viewerEmployeeId: number,
): Promise<number | null> {
  if (query.employee_code !== undefined) {
    const rows = await database
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.code, query.employee_code))
      .limit(1)

    const row = rows.at(0)

    return row === undefined ? null : row.id
  }

  if (query.employee_id !== undefined) {
    const parsed = Number(query.employee_id)
    return Number.isInteger(parsed) ? parsed : null
  }

  return viewerEmployeeId
}
