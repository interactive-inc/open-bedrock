import { factory } from "@/lib/factory"
import { zAppExpenseInboxList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { employees, expenses } from "@/schema"
import { and, count, desc, eq, inArray, sql } from "drizzle-orm"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { listManagedEmployeeIds } from "@/lib/org/organization-authority"

/** GET /expenses/inbox — 承認待ちの経費一覧（承認権限が必要） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("expense:approve") === false) {
    throw new ForbiddenError()
  }

  const managedEmployeeIds = session.hasPermission("org:manage")
    ? null
    : await listManagedEmployeeIds(c, session.employeeId)

  if (managedEmployeeIds instanceof Error) {
    throw new InternalError("failed to resolve organization scope")
  }

  const pendingInScope =
    managedEmployeeIds === null
      ? eq(expenses.status, "pending")
      : managedEmployeeIds.length === 0
        ? and(eq(expenses.status, "pending"), sql`0 = 1`)
        : and(eq(expenses.status, "pending"), inArray(expenses.employeeId, [...managedEmployeeIds]))

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

  const [rows, totalRows] = await Promise.all([
    c.var.database
      .select({ expense: expenses, applicantName: employees.name })
      .from(expenses)
      .leftJoin(employees, eq(employees.id, expenses.employeeId))
      .where(pendingInScope)
      .orderBy(desc(expenses.id))
      .limit(limit)
      .offset(offset),
    c.var.database.select({ total: count() }).from(expenses).where(pendingInScope),
  ])

  const responseBody = zAppExpenseInboxList.parse({
    data: rows.map((row) => ({
      id: row.expense.id,
      applicant_name: row.applicantName ?? "",
      category: row.expense.category,
      amount: row.expense.amount,
      spent_at: row.expense.spentAt,
      status: row.expense.status,
      created_at: row.expense.createdAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
