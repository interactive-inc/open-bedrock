import { createClient } from "@/lib/api/hc-client"
import type { HealthCheckupResponse } from "@/lib/api/types/health-checkup-types"

/**
 * GET /health-checkups?fiscal_year=&employee_id=。健診・ストレスチェックの実施記録一覧を取得する。
 * 結果は返らない（実施情報のみ）。失敗時は Error を返す。
 */
export async function listHealthCheckups(props: {
  fiscalYear?: number
  employeeId?: number
}): Promise<ReadonlyArray<HealthCheckupResponse> | Error> {
  const client = await createClient()

  const response = await client["health-checkups"].$get({
    query: {
      fiscal_year: props.fiscalYear !== undefined ? String(props.fiscalYear) : undefined,
      employee_id: props.employeeId !== undefined ? String(props.employeeId) : undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load health checkups")
  }

  const body = await response.json()

  return body.data
}
