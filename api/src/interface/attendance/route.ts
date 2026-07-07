import { resolveAttendanceSearchQuery } from "@/interface/attendance/resolve-attendance-search-query"
import { resolveEmployeeRelation } from "@/lib/org/resolve-employee-relation"
import type { EmployeeRelation } from "@/lib/org/employee-relation"
import { hasPermission } from "@/lib/auth/has-permission"
import { listReportEmployeeIds } from "@/lib/org/list-report-employee-ids"
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
import { and, asc, count, eq, gte, inArray, lte } from "drizzle-orm"
import {
  BadRequestError,
  ForbiddenError,
  InternalError,
  UnauthorizedError,
} from "@/interface/lib/errors"

// GET /attendance — 勤怠検索。
// employee_id 指定で他者を1人閲覧できる(self→all→reports→department のスコープ判定)。
// scope=reports で配下全員分、scope=all で全社分を一覧する(対応 permission 必須)。
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const parsed = attendanceListQuerySchema.safeParse(c.req.query())

  if (parsed.success === false) {
    throw new BadRequestError("invalid query")
  }

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const scope = c.req.query("scope") ?? null

  const requestedEmployeeId = (() => {
    if (parsed.data.employee_id === undefined) return null
    const parsed2 = Number(parsed.data.employee_id)
    return Number.isInteger(parsed2) ? parsed2 : null
  })()

  const from = parsed.data.from ?? null

  const to = parsed.data.to ?? null

  const conditions: Array<SQL> = []

  if (requestedEmployeeId === null && scope === "reports") {
    if (hasPermission(session, "attendance:read:reports") === false) {
      throw new ForbiddenError()
    }

    const reportEmployeeIds = await listReportEmployeeIds({
      c,
      viewerEmployeeId: session.employeeId,
    })

    if (reportEmployeeIds instanceof Error) {
      throw new InternalError("failed to resolve report employees")
    }

    if (reportEmployeeIds.length === 0) {
      const emptyBody = zAppAttendanceRecordList.parse({ data: [], total: 0 })

      return c.json(emptyBody, 200)
    }

    conditions.push(inArray(attendanceRecords.employeeId, reportEmployeeIds))
  } else if (requestedEmployeeId === null && scope === "all") {
    if (hasPermission(session, "attendance:read:all") === false) {
      throw new ForbiddenError()
    }
  } else {
    const isViewingOthers =
      requestedEmployeeId !== null && requestedEmployeeId !== session.employeeId

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
      from,
      to,
      session: session,
      relation,
    })

    if (query instanceof ApplicationError) {
      throw toHttpException(query)
    }

    if (query.employeeId !== null) {
      conditions.push(eq(attendanceRecords.employeeId, query.employeeId))
    }
  }

  if (from !== null) {
    conditions.push(gte(attendanceRecords.workDate, from))
  }

  if (to !== null) {
    conditions.push(lte(attendanceRecords.workDate, to))
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
