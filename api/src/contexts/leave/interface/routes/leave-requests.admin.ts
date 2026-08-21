import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { leaveRequests } from "@/contexts/leave/infrastructure/schema/leave"
import { zValidator } from "@hono/zod-validator"
import { and, asc, count, desc, eq, gte, lte } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { ForbiddenError, UnauthorizedError } from "@/lib/http/errors"
import { zAppLeaveRequestAdminList } from "@/lib/app-schemas"
import { leaveTypeSchema } from "@/lib/schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { z } from "zod"
import { loadCurrentEmployeeDepartmentNames } from "@/api/http/utils/current-employee-departments"
import { InternalError } from "@/lib/http/errors"

const SORT_OPTIONS = {
  created_at_desc: desc(leaveRequests.createdAt),
  created_at_asc: asc(leaveRequests.createdAt),
  start_date_desc: desc(leaveRequests.startDate),
  start_date_asc: asc(leaveRequests.startDate),
} as const

type SortKey = keyof typeof SORT_OPTIONS

// @authorization permission - 権限キーで判定する
/**
 * GET /leave-requests/admin — 全社の休暇申請を横断で閲覧する管理画面用の一覧。
 * leave:read:all を持つロール(hr / admin)のみ許可。
 * フィルタ: status / applicant_id / leave_type / start_date 範囲(from / to)。
 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.enum(["pending", "approved", "rejected"]).optional(),
      applicant_id: z.string().optional(),
      leave_type: leaveTypeSchema.optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      sort: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("leave:read:all") === false) {
      throw new ForbiddenError()
    }

    const query = c.req.valid("query")

    const limit = toBoundedInt({
      raw: query.limit,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })

    const offset = toBoundedInt({
      raw: query.offset,
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    })

    const conditions: Array<SQL> = []

    if (query.status !== undefined) {
      conditions.push(eq(leaveRequests.status, query.status))
    }

    if (query.applicant_id !== undefined && query.applicant_id !== "") {
      const applicantId = Number(query.applicant_id)

      if (Number.isInteger(applicantId)) {
        conditions.push(eq(leaveRequests.employeeId, applicantId))
      }
    }

    if (query.leave_type !== undefined) {
      conditions.push(eq(leaveRequests.leaveType, query.leave_type))
    }

    // from / to は start_date に対して。「6/1 以降に始まる休暇」のような検索を想定。
    if (query.from !== undefined && query.from !== "") {
      conditions.push(gte(leaveRequests.startDate, query.from))
    }

    if (query.to !== undefined && query.to !== "") {
      conditions.push(lte(leaveRequests.startDate, query.to))
    }

    const where = conditions.length === 0 ? undefined : and(...conditions)

    const sortQuery = query.sort ?? ""

    const sortKey: SortKey = Object.hasOwn(SORT_OPTIONS, sortQuery)
      ? (sortQuery as SortKey)
      : "created_at_desc"

    const rows = await c.var.database
      .select({
        id: leaveRequests.id,
        employeeId: leaveRequests.employeeId,
        applicantName: employees.name,
        applicantDeptName: employees.deptName,
        leaveType: leaveRequests.leaveType,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        days: leaveRequests.days,
        unit: leaveRequests.unit,
        hours: leaveRequests.hours,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        createdAt: leaveRequests.createdAt,
      })
      .from(leaveRequests)
      .leftJoin(employees, eq(employees.id, leaveRequests.employeeId))
      .where(where)
      .orderBy(SORT_OPTIONS[sortKey])
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(leaveRequests)
      .where(where)

    const currentDepartments = await loadCurrentEmployeeDepartmentNames(
      c,
      rows.map((row) => row.employeeId),
    )
    if (currentDepartments instanceof Error) {
      throw new InternalError("failed to load current departments")
    }

    const responseBody = zAppLeaveRequestAdminList.parse({
      data: rows.map((row) => ({
        id: row.id,
        applicant_id: row.employeeId,
        applicant_name: row.applicantName ?? "",
        applicant_dept_name:
          currentDepartments.source === "lifecycle"
            ? (currentDepartments.names.get(row.employeeId) ?? null)
            : row.applicantDeptName,
        leave_type: row.leaveType,
        start_date: row.startDate,
        end_date: row.endDate,
        days: row.days,
        unit: row.unit,
        hours: row.hours,
        reason: row.reason,
        status: row.status,
        created_at: row.createdAt,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)
