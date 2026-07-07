import { resolveAttendanceSearchQuery } from "@/interface/attendance/resolve-attendance-search-query"
import { resolveEmployeeRelation } from "@/lib/org/resolve-employee-relation"
import type { EmployeeRelation } from "@/lib/org/employee-relation"
import { attendanceListQuerySchema } from "@/interface/attendance/attendance-list-query"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"
import { zAppAttendanceRecordList } from "@/lib/app-schemas"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { attendanceRecords } from "@/schema"
import type { SQL } from "drizzle-orm"
import { and, asc, count, eq, gte, lte } from "drizzle-orm"
import { BadRequestError, InternalError, UnauthorizedError } from "@/interface/lib/errors"

// GET /attendance — 勤怠検索（他人の閲覧は attendance:read:all 権限のみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const parsed = attendanceListQuerySchema.safeParse(c.req.query())

  if (parsed.success === false) {
    throw new BadRequestError("invalid query")
  }

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const requestedEmployeeId = (() => {
    if (parsed.data.employee_id === undefined) return null
    const parsed2 = Number(parsed.data.employee_id)
    return Number.isInteger(parsed2) ? parsed2 : null
  })()

  const isViewingOthers = requestedEmployeeId !== null && requestedEmployeeId !== session.employeeId

  let relation: EmployeeRelation | null = null

  if (isViewingOthers && requestedEmployeeId !== null) {
    const resolved = await resolveEmployeeRelation({
      c,
      viewerEmployeeId: session.employeeId,
      targetEmployeeId: requestedEmployeeId,
    })

    if (resolved instanceof Error) {
      throw new InternalError("failed to resolve employee relation")
    }

    relation = resolved
  }

  const query = resolveAttendanceSearchQuery({
    requestedEmployeeId,
    from: parsed.data.from ?? null,
    to: parsed.data.to ?? null,
    session: session,
    relation,
  })

  if (query instanceof ApplicationError) {
    throw toHttpException(query)
  }

  const conditions: Array<SQL> = []

  if (query.employeeId !== null) {
    conditions.push(eq(attendanceRecords.employeeId, query.employeeId))
  }

  if (query.from !== null) {
    conditions.push(gte(attendanceRecords.workDate, query.from))
  }

  if (query.to !== null) {
    conditions.push(lte(attendanceRecords.workDate, query.to))
  }

  const limit = toBoundedInt({
    raw: parsed.data.limit,
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: parsed.data.offset,
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const where = conditions.length === 0 ? undefined : and(...conditions)

  const [rows, totalRows] = await Promise.all([
    c.var.database
      .select()
      .from(attendanceRecords)
      .where(where)
      .orderBy(asc(attendanceRecords.id))
      .limit(limit)
      .offset(offset),
    c.var.database.select({ total: count() }).from(attendanceRecords).where(where),
  ])

  const responseBody = zAppAttendanceRecordList.parse({
    data: rows.map((row) => ({
      id: row.id,
      employee_id: row.employeeId,
      work_date: row.workDate,
      clock_in_at: row.clockInAt,
      clock_out_at: row.clockOutAt,
      work_minutes: row.workMinutes,
      status: row.status,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
