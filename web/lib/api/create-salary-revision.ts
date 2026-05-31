import { createClient } from "@/lib/api/hc-client"
import type { SalaryRevisionCreateRequest } from "@/lib/api/types/payroll-types"

// POST /salary-revisions。特権ロールが給与改定を作成する。
export async function createSalaryRevision(request: SalaryRevisionCreateRequest) {
  const client = await createClient()

  const response = await client["salary-revisions"].$post({ json: request })

  if (response.status >= 400) {
    return new Error("failed to create salary revision")
  }

  return response.json()
}
