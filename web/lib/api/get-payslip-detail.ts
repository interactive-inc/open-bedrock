import { createClient } from "@/lib/api/hc-client"
import type { PayslipDetailResponse } from "@/lib/api/types/payroll-types"

// GET /payslips/:id。1 件の給与明細詳細を取得する。
export async function getPayslipDetail(id: number): Promise<PayslipDetailResponse | Error> {
  const client = await createClient()

  const response = await client.payslips[":id"].$get({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return new Error("failed to load payslip detail")
  }

  return response.json()
}
