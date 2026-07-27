import { CreateLeaveRequest } from "@/application/leave/create-leave-request"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import {
  ForbiddenError,
  InternalError,
  UnauthorizedError,
  UnprocessableEntityError,
} from "@/interface/lib/errors"
import { zAppLeaveRequest, zAppLeaveRequestAdminList } from "@/lib/app-schemas"
import { canReadLeaveOf } from "@/interface/routes/leave-requests/can-read-leave-of"
import { listDepartmentEmployeeIds } from "@/interface/utils/list-department-employee-ids"
import { listReportEmployeeIds } from "@/interface/utils/list-report-employee-ids"
import { resolveEmployeeRelation } from "@/lib/org/resolve-employee-relation"
import { factory } from "@/interface/utils/factory"
import { isoDate, leaveTypeSchema } from "@/lib/schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { employees, leaveRequests } from "@/schema"
import { and, count, desc, eq, inArray } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/**
 * GET /leave-requests — 他者の休暇申請一覧。
 * employee_id 指定で他者を1人閲覧できる(self→all→reports→department のスコープ判定)。
 * scope=reports で配下全員分、scope=all で全社分を一覧する(対応 permission 必須)。
 * 本人分は /leave/requests/me を使う。
 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      employee_id: z.string().optional(),
      scope: z.enum(["reports", "all", "department"]).optional(),
      department_code: z.string().optional(),
      status: z.enum(["pending", "approved", "rejected"]).optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const query = c.req.valid("query")

    const requestedEmployeeId = (() => {
      if (query.employee_id === undefined) return null
      const parsed = Number(query.employee_id)
      return Number.isInteger(parsed) ? parsed : null
    })()

    const conditions: Array<SQL> = []

    if (requestedEmployeeId === null && query.scope === "reports") {
      if (session.hasPermission("leave:read:reports") === false) {
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
        const emptyBody = zAppLeaveRequestAdminList.parse({ data: [], total: 0 })

        return c.json(emptyBody, 200)
      }

      conditions.push(inArray(leaveRequests.employeeId, reportEmployeeIds))
    } else if (requestedEmployeeId === null && query.scope === "department") {
      const departmentCode = query.department_code ?? null

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
        session.hasPermission("leave:read:all") ||
        (session.hasPermission("leave:read:department") && isMember)

      if (allowed === false) {
        throw new ForbiddenError()
      }

      if (departmentEmployeeIds.length === 0) {
        const emptyBody = zAppLeaveRequestAdminList.parse({ data: [], total: 0 })

        return c.json(emptyBody, 200)
      }

      conditions.push(inArray(leaveRequests.employeeId, departmentEmployeeIds))
    } else if (requestedEmployeeId === null && query.scope === "all") {
      if (session.hasPermission("leave:read:all") === false) {
        throw new ForbiddenError()
      }
    } else {
      const targetEmployeeId =
        requestedEmployeeId === null ? session.employeeId : requestedEmployeeId

      const relation = await resolveEmployeeRelation({
        c,
        viewerEmployeeId: session.employeeId,
        targetEmployeeId,
      })

      if (relation instanceof Error) {
        throw new InternalError("failed to resolve employee relation")
      }

      if (canReadLeaveOf(session, relation) === false) {
        throw new ForbiddenError()
      }

      conditions.push(eq(leaveRequests.employeeId, targetEmployeeId))
    }

    if (query.status !== undefined) {
      conditions.push(eq(leaveRequests.status, query.status))
    }

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

    const where = conditions.length === 0 ? undefined : and(...conditions)

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
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        createdAt: leaveRequests.createdAt,
      })
      .from(leaveRequests)
      .leftJoin(employees, eq(employees.id, leaveRequests.employeeId))
      .where(where)
      .orderBy(desc(leaveRequests.id))
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(leaveRequests)
      .where(where)

    const responseBody = zAppLeaveRequestAdminList.parse({
      data: rows.map((row) => ({
        id: row.id,
        applicant_id: row.employeeId,
        applicant_name: row.applicantName ?? "",
        applicant_dept_name: row.applicantDeptName,
        leave_type: row.leaveType,
        start_date: row.startDate,
        end_date: row.endDate,
        days: row.days,
        reason: row.reason,
        status: row.status,
        created_at: row.createdAt,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)

/** POST /leave-requests — 本人として休暇申請を作成 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({
        leave_type: leaveTypeSchema,
        start_date: isoDate,
        end_date: isoDate,
        reason: z.string().max(3_000).nullable().optional(),
      })
      .refine((d) => d.start_date <= d.end_date, {
        message: "end_date must be on or after start_date",
        path: ["end_date"],
      }),
  ),
  async (c) => {
    const body = c.req.valid("json")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const created = await new CreateLeaveRequest(c).run({
      employeeId: session.employeeId,
      leaveType: body.leave_type,
      startDate: body.start_date,
      endDate: body.end_date,
      reason: body.reason ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppLeaveRequest.parse({
      id: created.id,
      employee_id: created.employeeId,
      leave_type: created.leaveType,
      start_date: created.startDate,
      end_date: created.endDate,
      days: created.days,
      reason: created.reason,
      status: created.status,
      approver_id: created.approverId,
      decided_comment: created.decidedComment,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
