import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
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
    return toResponseError(response, {
      fallback: "給与明細の訂正に失敗しました",
      conflictMessages: {
        "payslip period already exists for the employee": "同一期間の給与明細が既に存在します",
        "the payslip is not editable": "この給与明細は訂正できません",
      },
    })
  }

  return response.json()
}
