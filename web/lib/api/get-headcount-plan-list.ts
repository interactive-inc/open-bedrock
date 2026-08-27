import { createClient } from "@/lib/api/hc-client"

/** GET /headcount-plans。人員計画一覧に実在籍数（active）を添えて返す（headcount_plan:read:all）。 */
export async function getHeadcountPlanList(query: { fiscalYear?: number }) {
  const client = await createClient()

  const response = await client["headcount-plan"]["headcount-plans"].$get({
    query: {
      fiscal_year: query.fiscalYear === undefined ? undefined : String(query.fiscalYear),
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load headcount plans")
  }

  const body = await response.json()

  return body.data
}
