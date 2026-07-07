import { createClient } from "@/lib/api/hc-client"
import type { WorkAccidentResponse } from "@/lib/api/types/work-accident-types"

// GET /work-accidents?status=&employee_id=。労災・事故の発生記録一覧を取得する。失敗時は Error を返す。
export async function listWorkAccidents(props: {
  status?: string
  employeeId?: number
}): Promise<ReadonlyArray<WorkAccidentResponse> | Error> {
  const client = await createClient()

  const response = await client["work-accidents"].$get({
    query: {
      status: props.status,
      employee_id: props.employeeId !== undefined ? String(props.employeeId) : undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load work accidents")
  }

  const body = await response.json()

  return body.data
}
