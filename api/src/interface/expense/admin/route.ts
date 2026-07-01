import { canViewAllExpenses } from "@/lib/expense/can-view-all-expenses"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { employees, expenses } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { and, asc, count, desc, eq, gte, lte } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { zAppExpenseAdminList } from "@/lib/app-schemas"
import { expenseCategorySchema, expenseStatusSchema } from "@/lib/schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { z } from "zod"

// 並び順ホワイトリスト。未知の値は created_at desc にフォールバックする。
const SORT_OPTIONS = {
  created_at_desc: desc(expenses.createdAt),
  created_at_asc: asc(expenses.createdAt),
  amount_desc: desc(expenses.amount),
  amount_asc: asc(expenses.amount),
} as const

type SortKey = keyof typeof SORT_OPTIONS

// GET /expenses/admin — 全社の経費申請を横断で閲覧する管理画面用の一覧。
// expense:read:all を持つロール(hr / admin)のみ許可。
// フィルタ: status / applicant_id / category / created_at 範囲(from / to)。
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: expenseStatusSchema.optional(),
      applicant_id: z.string().optional(),
      category: expenseCategorySchema.optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      sort: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (canViewAllExpenses(session) === false) {
      throw new ForbiddenError()
    }

    const query = c.req.valid("query")

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

    const conditions: Array<SQL> = []

    if (query.status !== undefined) {
      conditions.push(eq(expenses.status, query.status))
    }

    if (query.applicant_id !== undefined && query.applicant_id !== "") {
      const applicantId = Number(query.applicant_id)

      if (Number.isInteger(applicantId)) {
        conditions.push(eq(expenses.employeeId, applicantId))
      }
    }

    if (query.category !== undefined) {
      conditions.push(eq(expenses.category, query.category))
    }

    if (query.from !== undefined && query.from !== "") {
      conditions.push(gte(expenses.createdAt, query.from))
    }

    if (query.to !== undefined && query.to !== "") {
      conditions.push(lte(expenses.createdAt, query.to))
    }

    const where = conditions.length === 0 ? undefined : and(...conditions)

    const sortQuery = query.sort ?? ""

    const sortKey: SortKey = sortQuery in SORT_OPTIONS ? (sortQuery as SortKey) : "created_at_desc"

    const rows = await c.var.database
      .select({
        id: expenses.id,
        employeeId: expenses.employeeId,
        applicantName: employees.name,
        applicantDeptName: employees.deptName,
        category: expenses.category,
        amount: expenses.amount,
        spentAt: expenses.spentAt,
        status: expenses.status,
        createdAt: expenses.createdAt,
      })
      .from(expenses)
      .leftJoin(employees, eq(employees.id, expenses.employeeId))
      .where(where)
      .orderBy(SORT_OPTIONS[sortKey])
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database.select({ total: count() }).from(expenses).where(where)

    const responseBody = zAppExpenseAdminList.parse({
      data: rows.map((row) => ({
        id: row.id,
        applicant_id: row.employeeId,
        applicant_name: row.applicantName ?? "",
        applicant_dept_name: row.applicantDeptName,
        category: row.category,
        amount: row.amount,
        spent_at: row.spentAt,
        status: row.status,
        created_at: row.createdAt,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)
