import { createClient } from "@/lib/api/hc-client"

export type BudgetListFilter = {
  organizationUnitId: string | null
  fiscalPeriod: string | null
}

/** GET /department-budgets。部署予算の一覧。budget:manage が無いと 403。 */
export async function getBudgetList(filter: BudgetListFilter) {
  const client = await createClient()

  const response = await client["expense"]["department-budgets"].$get({
    query: {
      organization_unit_id: filter.organizationUnitId ?? undefined,
      fiscal_period: filter.fiscalPeriod ?? undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load budget list")
  }

  const body = await response.json()
  return body.data
}
