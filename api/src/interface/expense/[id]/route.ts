import { DeleteExpense } from "@/application/expense/delete-expense"
import { UpdateExpense } from "@/application/expense/update-expense"
import { canDecideExpense } from "@/domain/expense/can-decide-expense"
import type { Expense } from "@/domain/expense/expense"
import { toExpenseId } from "@/domain/expense/to-expense-id"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { employees, expenses } from "@/schema"
import { eq } from "drizzle-orm"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 経費をレスポンス用の snake_case に整形する。
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

// GET /expenses/:id — 経費の詳細（本人または承認権限者のみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const expenseId = toExpenseId(c.req.param("id") ?? "")

  if (expenseId === null) {
    throw new BadRequestError("invalid expense id")
  }

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

  if (isOwner === false && canDecideExpense(session.role) === false) {
    throw new ForbiddenError()
  }

  const body = {
    id: row.expense.id,
    employee_id: row.expense.employeeId,
    applicant_name: row.applicantName ?? "",
    category: row.expense.category,
    amount: row.expense.amount,
    spent_at: row.expense.spentAt,
    note: row.expense.note,
    status: row.expense.status,
    created_at: row.expense.createdAt,
  }

  return c.json(body, 200)
})

// PUT /expenses/:id — 経費申請の内容を変更（本人のみ・pending のみ）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      category: z.enum(["transport", "supplies", "entertainment", "books", "other"]),
      amount: z.number(),
      spent_at: z.string().min(1),
      note: z.string().nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const expenseId = toExpenseId(c.req.param("id") ?? "")

    if (expenseId === null) {
      throw new BadRequestError("invalid expense id")
    }

    const json = c.req.valid("json")

    const expense = await new UpdateExpense(c).run({
      expenseId: expenseId,
      employeeId: session.employeeId,
      category: json.category,
      amount: json.amount,
      spentAt: json.spent_at,
      note: json.note ?? null,
    })

    if (expense instanceof Error) {
      throw new InternalError("failed to update expense")
    }

    if ("reason" in expense) {
      if (expense.reason === "expense_not_found") {
        throw new NotFoundError("expense not found")
      }

      if (expense.reason === "not_owner") {
        throw new ForbiddenError("not the owner")
      }

      throw new ConflictError("the expense is not editable")
    }

    return c.json(toResponseBody(expense), 200)
  },
)

// DELETE /expenses/:id — 経費申請を取り下げ（本人のみ・pending のみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const expenseId = toExpenseId(c.req.param("id") ?? "")

  if (expenseId === null) {
    throw new BadRequestError("invalid expense id")
  }

  const result = await new DeleteExpense(c).run({
    expenseId: expenseId,
    employeeId: session.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to delete expense")
  }

  if (result.reason === "expense_not_found") {
    throw new NotFoundError("expense not found")
  }

  if (result.reason === "not_owner") {
    throw new ForbiddenError("not the owner")
  }

  if (result.reason === "not_deletable") {
    throw new ConflictError("the expense is not deletable")
  }

  return c.body(null, 204)
})
