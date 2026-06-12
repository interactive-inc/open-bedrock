import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { PayslipIssueRequest } from "@/lib/api/types/payroll-types"

// POST /payslips。特権ロールが対象社員の給与明細を発行する。
export async function issuePayslip(request: PayslipIssueRequest) {
  const client = await createClient()

  const response = await client.payslips.$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "給与明細の発行に失敗しました",
      conflictMessages: {
        "payslip already issued for this period": "同一期間の給与明細が既に発行されています",
      },
    })
  }

  return response.json()
}
