import { canDecideExpense } from "@/domain/expense/can-decide-expense"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { employees, expenses } from "@/schema"
import { eq } from "drizzle-orm"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"

// GET /expenses/inbox — 承認待ちの経費一覧（承認権限が必要）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (canDecideExpense(session.role) === false) {
    throw new ForbiddenError()
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
    .select({ expense: expenses, applicantName: employees.name })
    .from(expenses)
    .leftJoin(employees, eq(employees.id, expenses.employeeId))
    .where(eq(expenses.status, "pending"))
    .limit(limit)
    .offset(offset)

  const body = rows.map((row) => ({
    id: row.expense.id,
    applicant_name: row.applicantName ?? "",
    category: row.expense.category,
    amount: row.expense.amount,
    spent_at: row.expense.spentAt,
    status: row.expense.status,
    created_at: row.expense.createdAt,
  }))

  return c.json(body, 200)
})
