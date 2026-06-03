import { createClient } from "@/lib/api/hc-client"
import type { PayslipCorrectRequest, PayslipCorrectResponse } from "@/lib/api/types/payroll-types"

// PUT /payslips/:id。特権ロールが給与明細の期間と金額を訂正する。
// 本人以外でも特権ロールなら可。非特権は 403、不存在は 404 を api が返すため戻りは Error。
export async function correctPayslip(
  id: number,
  request: PayslipCorrectRequest,
): Promise<PayslipCorrectResponse | Error> {
  const client = await createClient()

  const response = await client.payslips[":id"].$put({
    param: { id: String(id) },
    json: request,
  })

  if (response.status >= 400) {
    return new Error("failed to correct payslip")
  }

  return response.json()
}
