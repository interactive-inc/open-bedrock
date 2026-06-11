import { createClient } from "@/lib/api/hc-client"
import type { PayslipMineResponse } from "@/lib/api/types/payroll-types"

// GET /payslips/me。自分の給与明細一覧。period で絞り込み可能。
export async function getMyPayslips(
  period: string | null,
): Promise<Array<PayslipMineResponse> | Error> {
  const client = await createClient()

  const response = await client.payslips.me.$get({
    query: { period: period ?? undefined },
  })

  if (response.status >= 400) {
    return new Error("failed to load my payslips")
  }

  const body = await response.json()
  return body.data
}
