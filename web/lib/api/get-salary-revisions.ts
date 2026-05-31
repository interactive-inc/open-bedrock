import { createClient } from "@/lib/api/hc-client"
import type { SalaryRevisionResponse } from "@/lib/api/types/payroll-types"

// GET /salary-revisions/:employee_code。対象社員の給与改定履歴。
// api 側で特権ロール限定のため、権限不足時は 403 でエラーになる。
export async function getSalaryRevisions(
  employeeCode: string,
): Promise<Array<SalaryRevisionResponse> | Error> {
  const client = await createClient()

  const response = await client["salary-revisions"][":employee_code"].$get({
    param: { employee_code: employeeCode },
  })

  if (response.status >= 400) {
    return new Error("failed to load salary revisions")
  }

  return response.json()
}
