import { CreateBudget } from "@/application/budget/create-budget"
import { canManageBudgets } from "@/lib/budget/can-manage-budgets"
import { factory } from "@/lib/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppBudget, zAppBudgetList } from "@/lib/app-schemas"
import { isoDate } from "@/lib/schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { budgets, departments } from "@/schema"
import { and, asc, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// GET /budgets — 部署予算の一覧。部署・会計期間で絞り込む。budget:manage を持つロールのみ。
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      department_id: z.string().optional(),
      fiscal_period: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (canManageBudgets(session) === false) {
      throw new ForbiddenError()
    }

    const query = c.req.valid("query")

    const conditions: Array<SQL> = []

    if (query.department_id !== undefined && query.department_id !== "") {
      const departmentId = Number(query.department_id)

      if (Number.isInteger(departmentId)) {
        conditions.push(eq(budgets.departmentId, departmentId))
      }
    }

    if (query.fiscal_period !== undefined && query.fiscal_period !== "") {
      conditions.push(eq(budgets.fiscalPeriod, query.fiscal_period))
    }

    const where = conditions.length === 0 ? undefined : and(...conditions)

    const rows = await c.var.database
      .select({
        id: budgets.id,
        departmentId: budgets.departmentId,
        departmentName: departments.name,
        fiscalPeriod: budgets.fiscalPeriod,
        periodStart: budgets.periodStart,
        periodEnd: budgets.periodEnd,
        amount: budgets.amount,
        name: budgets.name,
        note: budgets.note,
        createdAt: budgets.createdAt,
      })
      .from(budgets)
      .leftJoin(departments, eq(departments.id, budgets.departmentId))
      .where(where)
      .orderBy(asc(budgets.departmentId), asc(budgets.fiscalPeriod))

    const responseBody = zAppBudgetList.parse({
      data: rows.map((row) => ({
        id: row.id,
        department_id: row.departmentId,
        department_name: row.departmentName,
        fiscal_period: row.fiscalPeriod,
        period_start: row.periodStart,
        period_end: row.periodEnd,
        amount: row.amount,
        name: row.name,
        note: row.note,
        created_at: row.createdAt,
      })),
      total: rows.length,
    })

    return c.json(responseBody, 200)
  },
)

// POST /budgets — 部署予算を登録する。budget:manage を持つロールのみ。
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      department_id: z.number().positive().int().safe(),
      fiscal_period: z.string().min(1).max(200),
      period_start: isoDate,
      period_end: isoDate,
      amount: z.number().positive().int().safe(),
      name: z.string().min(1).max(200),
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (canManageBudgets(session) === false) {
      throw new ForbiddenError()
    }

    const body = c.req.valid("json")

    const created = await new CreateBudget(c).run({
      departmentId: body.department_id,
      fiscalPeriod: body.fiscal_period,
      periodStart: body.period_start,
      periodEnd: body.period_end,
      amount: body.amount,
      name: body.name,
      note: body.note ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppBudget.parse({
      id: created.id,
      department_id: created.departmentId,
      fiscal_period: created.fiscalPeriod,
      period_start: created.periodStart,
      period_end: created.periodEnd,
      amount: created.amount,
      name: created.name,
      note: created.note,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
