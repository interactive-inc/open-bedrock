import { employees } from "@/contexts/company-compatibility/infrastructure/schema/employee"
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT, MAX_LIST_OFFSET, toBoundedInt } from "@/contexts/company-compatibility/interface/utils/to-bounded-int"
import { EnrollTraining } from "@/contexts/training/application/enroll-training"
import { trainingEnrollments } from "@/contexts/training/infrastructure/schema/training"
import { type Variables } from "@/env"
import { zAppTrainingEnrollment, zAppTrainingEnrollmentList } from "@/lib/app-schemas"
import { ApplicationError } from "@/lib/errors"
import { codeSchema, isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { asc, count, eq } from "drizzle-orm"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      course_code: codeSchema,
      employee_code: codeSchema.optional(),
      due_date: isoDate.optional(),
    }),
  ),
  async (c) => {
    const body = c.req.valid("json")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const created = await new EnrollTraining(c).run({
      viewerEmployeeId: session.employeeId,
      session: session,
      courseCode: body.course_code,
      enrolleeEmployeeCode: body.employee_code ?? null,
      dueDate: body.due_date ?? null,
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppTrainingEnrollment.parse({
      id: created.id,
      course_id: created.courseId,
      employee_id: created.employeeId,
      status: created.status,
      completed_at: created.completedAt,
      score: created.score,
      due_date: created.dueDate,
    })

    return c.json(responseBody, 201)
  },
)

// @authorization permission - 権限キーで判定する
/** GET /training-enrollments — 受講状況を一覧する（管理権限で他者の指定が可能） */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({ employee_id: z.string().optional(), employee_code: codeSchema.optional() }),
  ),
  async (c) => {
    const query = c.req.valid("query")

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

    const requestsOthers = query.employee_id !== undefined || query.employee_code !== undefined

    if (requestsOthers === true && session.hasPermission("training:manage") === false) {
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
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(trainingEnrollments)
      .where(eq(trainingEnrollments.employeeId, targetEmployeeId))

    const responseBody = zAppTrainingEnrollmentList.parse({
      data: rows.map((row) => ({
        id: row.id,
        course_id: row.courseId,
        employee_id: row.employeeId,
        status: row.status,
        completed_at: row.completedAt,
        score: row.score,
        due_date: row.dueDate,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

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

    if (Number.isInteger(parsed) === false || parsed <= 0) {
      return null
    }

    // employee_code 指定時と同様に実在確認する（挙動の対称性を保つ）。
    const rows = await database
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.id, parsed))
      .limit(1)

    const row = rows.at(0)

    return row === undefined ? null : row.id
  }

  return viewerEmployeeId
}
