import { canViewOthers } from "@/lib/goal/goal-access"
import { factory } from "@/lib/factory"
import { zAppGoalList } from "@/lib/app-schemas"
import { goals } from "@/schema"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { and, count, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { resolveOrganizationAuthority } from "@/lib/org/organization-authority"
import { hasPermission } from "@/lib/auth/has-permission"

// GET /goals — 本人の目標一覧。特権ロールは employee_id 指定で他者を閲覧できる
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const period = c.req.query("period") ?? null

  const employeeIdParam = c.req.query("employee_id")

  const requestedEmployeeId = (() => {
    if (employeeIdParam === undefined) return null
    const parsed = Number(employeeIdParam)
    return Number.isInteger(parsed) ? parsed : null
  })()

  const targetEmployeeId = requestedEmployeeId === null ? session.employeeId : requestedEmployeeId

  const isViewingOthers = targetEmployeeId !== session.employeeId

  if (isViewingOthers && canViewOthers(session) === false) {
    throw new ForbiddenError()
  }

  if (isViewingOthers && hasPermission(session, "org:manage") === false) {
    const authority = await resolveOrganizationAuthority(c, session.employeeId, targetEmployeeId)
    if (authority instanceof Error) throw new InternalError("failed to resolve organization scope")
    if (authority.managementChain === false && authority.departmentManager === false) {
      throw new ForbiddenError()
    }
  }

  const conditions: Array<SQL> = [eq(goals.employeeId, targetEmployeeId)]

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
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
