import { createClient } from "@/lib/api/hc-client"
import type { ExpenseCategory, ExpenseStatus } from "@/lib/api/types/expense-types"

export type ExpenseAdminSort = "created_at_desc" | "created_at_asc" | "amount_desc" | "amount_asc"

export type ExpenseAdminFilter = {
  status: ExpenseStatus | null
  applicantId: number | null
  category: ExpenseCategory | null
  from: string | null
  to: string | null
}

type Params = {
  limit?: number
  offset?: number
  sort?: ExpenseAdminSort
}

// GET /expenses/admin。全社の経費申請を横断で取得する。expense:read:all が無いと 403。
export async function getExpenseAdminList(filter: ExpenseAdminFilter, params: Params = {}) {
  const client = await createClient()

  const response = await client.expenses.admin.$get({
    query: {
      status: filter.status ?? undefined,
      applicant_id: filter.applicantId !== null ? String(filter.applicantId) : undefined,
      category: filter.category ?? undefined,
      from: filter.from ?? undefined,
      to: filter.to ?? undefined,
      sort: params.sort,
      limit: params.limit !== undefined ? String(params.limit) : undefined,
      offset: params.offset !== undefined ? String(params.offset) : undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load expense admin list")
  }

  return response.json()
}
