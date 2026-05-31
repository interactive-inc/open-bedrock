import { createClient } from "@/lib/api/hc-client"
import type { PayslipIssueRequest } from "@/lib/api/types/payroll-types"

// POST /payslips。特権ロールが対象社員の給与明細を発行する。
export async function issuePayslip(request: PayslipIssueRequest) {
  const client = await createClient()

  const response = await client.payslips.$post({ json: request })

  if (response.status >= 400) {
    return new Error("failed to issue payslip")
  }

  return response.json()
}
