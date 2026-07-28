import { createClient } from "@/lib/api/hc-client"

export type BudgetListFilter = {
  departmentId: number | null
  fiscalPeriod: string | null
}

/** GET /department-budgets。部署予算の一覧。budget:manage が無いと 403。 */
export async function getBudgetList(filter: BudgetListFilter) {
  const client = await createClient()

  const response = await client["department-budgets"].$get({
    query: {
      department_id: filter.departmentId !== null ? String(filter.departmentId) : undefined,
      fiscal_period: filter.fiscalPeriod ?? undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load budget list")
  }

  const body = await response.json()
  return body.data
}
