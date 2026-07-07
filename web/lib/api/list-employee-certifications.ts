import { createClient } from "@/lib/api/hc-client"
import type { EmployeeCertificationResponse } from "@/lib/api/types/certification-types"

// GET /employee-certifications?employee_id=。資格保有記録一覧を取得する。
// employee_id 省略時は本人分。失敗時は Error を返す。
export async function listEmployeeCertifications(props: {
  employeeId?: number
}): Promise<ReadonlyArray<EmployeeCertificationResponse> | Error> {
  const client = await createClient()

  const response = await client["employee-certifications"].$get({
    query: {
      employee_id: props.employeeId !== undefined ? String(props.employeeId) : undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load employee certifications")
  }

  const body = await response.json()

  return body.data
}
