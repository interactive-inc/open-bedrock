import { DeleteExpense } from "@/application/expense/delete-expense"
import { UpdateExpense } from "@/application/expense/update-expense"
import { resolveOrganizationAuthority } from "@/lib/org/organization-authority"
import type { Expense } from "@/domain/expense/expense.entity"
import { factory } from "@/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppExpense, zAppExpenseDetail } from "@/lib/app-schemas"
import { expenseCategorySchema, isoDate } from "@/lib/schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { employees, expenses } from "@/schema"
import { eq } from "drizzle-orm"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** 経費をレスポンス用の snake_case に整形する。 */
function toResponseBody(expense: Expense) {
  return {
    id: expense.id,
    employee_id: expense.employeeId,
    category: expense.category,
    amount: expense.amount,
    spent_at: expense.spentAt,
    note: expense.note,
    status: expense.status,
    created_at: expense.createdAt,
  }
}

/** GET /expenses/:id — 経費の詳細（本人または承認権限者のみ） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const expenseId = validateIntParam(c.req.param("id"), "expense")

  const rows = await c.var.database
    .select({ expense: expenses, applicantName: employees.name })
    .from(expenses)
    .leftJoin(employees, eq(employees.id, expenses.employeeId))
    .where(eq(expenses.id, expenseId))
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("expense not found")
  }

  const isOwner = row.expense.employeeId === session.employeeId

  if (isOwner === false && session.hasPermission("expense:read:all") === false) {
    if (session.hasPermission("expense:approve") === false) {
      throw new ForbiddenError()
    }

    if (session.hasPermission("org:manage") === false) {
      const organizationAuthority = await resolveOrganizationAuthority(
        c,
        session.employeeId,
        row.expense.employeeId,
      )

      if (organizationAuthority instanceof Error) {
        throw new InternalError("failed to resolve organization scope")
      }

      if (
        organizationAuthority.managementChain === false &&
        organizationAuthority.departmentManager === false
      ) {
        throw new ForbiddenError()
      }
    }
  }

  const responseBody = zAppExpenseDetail.parse({
    id: row.expense.id,
    employee_id: row.expense.employeeId,
    applicant_name: row.applicantName ?? "",
    category: row.expense.category,
    amount: row.expense.amount,
    spent_at: row.expense.spentAt,
    note: row.expense.note,
    status: row.expense.status,
    created_at: row.expense.createdAt,
  })

  return c.json(responseBody, 200)
})

/** PUT /expenses/:id — 経費申請の内容を変更（本人のみ・pending のみ） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      category: expenseCategorySchema,
      amount: z.number().positive().int().safe(),
      spent_at: isoDate,
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const expenseId = validateIntParam(c.req.param("id"), "expense")

    const json = c.req.valid("json")

    const expense = await new UpdateExpense(c).run({
      expenseId,
      employeeId: session.employeeId,
      category: json.category,
      amount: json.amount,
      spentAt: json.spent_at,
      note: json.note ?? null,
    })

    if (expense instanceof ApplicationError) {
      throw toHttpException(expense)
    }

    const responseBody = zAppExpense.parse(toResponseBody(expense))

    return c.json(responseBody, 200)
  },
)

/** DELETE /expenses/:id — 経費申請を取り下げ（本人のみ・pending のみ） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const expenseId = validateIntParam(c.req.param("id"), "expense")

  const result = await new DeleteExpense(c).run({
    expenseId,
    employeeId: session.employeeId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
