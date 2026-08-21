import { resolveAttendanceSearchQuery } from "@/contexts/attendance/interface/http/attendance-records/resolve-attendance-search-query"
import { resolveEmployeeRelation } from "@/contexts/company/infrastructure/organization/resolve-employee-relation.repository"
import type { EmployeeRelation } from "@/contexts/company/domain/organization/employee-relation"
import { listDepartmentEmployeeIds } from "@/contexts/company/interface/utils/list-department-employee-ids"
import { listReportEmployeeIds } from "@/contexts/company/interface/utils/list-report-employee-ids"
import { attendanceListQuerySchema } from "@/contexts/attendance/interface/http/attendance-records/attendance-list-query"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"
import { zAppAttendanceRecordList } from "@/lib/app-schemas"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { attendanceRecords } from "@/contexts/attendance/infrastructure/schema/attendance"
import type { SQL } from "drizzle-orm"
import { and, asc, count, gte, inArray, lte } from "drizzle-orm"
import {
  BadRequestError,
  ForbiddenError,
  InternalError,
  UnauthorizedError,
  UnprocessableEntityError,
} from "@/contexts/company/interface/lib/errors"

// @authorization permission - 権限キーで判定する
/**
 * GET /attendance-records — 勤怠検索。
 * employee_id 指定で他者を1人閲覧できる(self→all→reports→department のスコープ判定)。
 * scope=reports で配下全員分、scope=all で全社分を一覧する(対応 permission 必須)。
 */
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
    if (session.hasPermission("attendance:read:reports") === false) {
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
  } else if (requestedEmployeeId === null && scope === "department") {
    const departmentCode = c.req.query("department_code") ?? null

    if (departmentCode === null) {
      throw new UnprocessableEntityError("department_code is required for scope=department")
    }

    const departmentEmployeeIds = await listDepartmentEmployeeIds({ c, departmentCode })

    if (departmentEmployeeIds instanceof Error) {
      throw new InternalError("failed to resolve department employees")
    }

    // 部署スコープは、全社閲覧権限があるか、自分がその部署に所属し部署閲覧権限を持つ場合だけ許可する。
    const isMember = departmentEmployeeIds.includes(session.employeeId)

    const allowed =
      session.hasPermission("attendance:read:all") ||
      (session.hasPermission("attendance:read:department") && isMember)

    if (allowed === false) {
      throw new ForbiddenError()
    }

    if (departmentEmployeeIds.length === 0) {
      const emptyBody = zAppAttendanceRecordList.parse({ data: [], total: 0 })

      return c.json(emptyBody, 200)
    }

    conditions.push(inArray(attendanceRecords.employeeId, departmentEmployeeIds))
  } else if (requestedEmployeeId === null && scope === "all") {
    if (session.hasPermission("attendance:read:all") === false) {
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

    if (query.employeeIds !== null) {
      conditions.push(inArray(attendanceRecords.employeeId, query.employeeIds))
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
