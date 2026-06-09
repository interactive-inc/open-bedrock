import { canViewOthers } from "@/domain/goal/goal-access"
import { factory } from "@/lib/factory"
import { goals } from "@/schema"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { and, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"

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

  if (isViewingOthers && canViewOthers(session.role) === false) {
    throw new ForbiddenError()
  }

  const conditions: Array<SQL> = [eq(goals.employeeId, targetEmployeeId)]

  if (period !== null) {
    conditions.push(eq(goals.period, period))
  }

  const rows = await c.var.database
    .select()
    .from(goals)
    .where(and(...conditions))
    .orderBy(goals.id)

  const responseBody = rows.map((row) => ({
    id: row.id,
    employee_id: row.employeeId,
    period: row.period,
    title: row.title,
    kpi: row.kpi,
    weight: row.weight,
    status: row.status,
  }))

  return c.json(responseBody, 200)
})
