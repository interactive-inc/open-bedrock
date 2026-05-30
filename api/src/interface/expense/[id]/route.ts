import { canDecideExpense } from "@/domain/expense/can-decide-expense"
import { toExpenseId } from "@/domain/expense/to-expense-id"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { employees, expenses } from "@/schema"
import { eq } from "drizzle-orm"
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"

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
