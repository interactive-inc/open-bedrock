import { canReadGoalOf } from "@/lib/goal/can-read-goal-of"
import { listDepartmentEmployeeIds } from "@/lib/org/list-department-employee-ids"
import { listReportEmployeeIds } from "@/lib/org/list-report-employee-ids"
import { resolveEmployeeRelation } from "@/lib/org/resolve-employee-relation"
import { factory } from "@/lib/factory"
import { zAppGoalList } from "@/lib/app-schemas"
import { goals } from "@/schema"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { and, count, eq, inArray } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import {
  ForbiddenError,
  InternalError,
  UnauthorizedError,
  UnprocessableEntityError,
} from "@/interface/lib/errors"

/**
 * GET /goals — 本人の目標一覧。
 * employee_id 指定で他者を1人閲覧できる(self→all→reports→department のスコープ判定)。
 * scope=reports で配下全員分、scope=all で全社分を一覧する(対応 permission 必須)。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const period = c.req.query("period") ?? null

  const scope = c.req.query("scope") ?? null

  const employeeIdParam = c.req.query("employee_id")

  const requestedEmployeeId = (() => {
    if (employeeIdParam === undefined) return null
    const parsed = Number(employeeIdParam)
    return Number.isInteger(parsed) ? parsed : null
  })()

  const conditions: Array<SQL> = []

  if (requestedEmployeeId === null && scope === "reports") {
    if (session.hasPermission("goal:read:reports") === false) {
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
      const emptyBody = zAppGoalList.parse({ data: [], total: 0 })

      return c.json(emptyBody, 200)
    }

    conditions.push(inArray(goals.employeeId, reportEmployeeIds))
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
      session.hasPermission("goal:read:all") ||
      (session.hasPermission("goal:read:department") && isMember)

    if (allowed === false) {
      throw new ForbiddenError()
    }

    if (departmentEmployeeIds.length === 0) {
      const emptyBody = zAppGoalList.parse({ data: [], total: 0 })

      return c.json(emptyBody, 200)
    }

    conditions.push(inArray(goals.employeeId, departmentEmployeeIds))
  } else if (requestedEmployeeId === null && scope === "all") {
    if (session.hasPermission("goal:read:all") === false) {
      throw new ForbiddenError()
    }
  } else {
    const targetEmployeeId = requestedEmployeeId === null ? session.employeeId : requestedEmployeeId

    const isViewingOthers = targetEmployeeId !== session.employeeId

    if (isViewingOthers) {
      const relation = await resolveEmployeeRelation({
        c,
        viewerEmployeeId: session.employeeId,
        targetEmployeeId,
      })

      if (relation instanceof Error) {
        throw new InternalError("failed to resolve employee relation")
      }

      if (canReadGoalOf(session, relation) === false) {
        throw new ForbiddenError()
      }
    }

    conditions.push(eq(goals.employeeId, targetEmployeeId))
  }

  if (period !== null) {
    conditions.push(eq(goals.period, period))
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
    .from(goals)
    .where(and(...conditions))
    .orderBy(goals.id)
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(goals)
    .where(and(...conditions))

  const responseBody = zAppGoalList.parse({
    data: rows.map((row) => ({
      id: row.id,
      employee_id: row.employeeId,
      period: row.period,
      title: row.title,
      kpi: row.kpi,
      weight: row.weight,
      status: row.status,
      owner_type: row.ownerType,
      parent_goal_id: row.parentGoalId,
      department_code: row.departmentCode,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
