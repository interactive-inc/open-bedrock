import { createClient } from "@/lib/api/hc-client"

/**
 * GET /org/reporting-line/:employee_code を session トークン付きで呼び、
 * 指定従業員から上位へのレポートライン（depth 昇順）を返す。
 */
export async function getOrgReportingLine(employeeCode: string) {
  const client = await createClient()

  const response = await client.org["reporting-line"][":employee_code"].$get({
    param: { employee_code: employeeCode },
  })

  if (response.status >= 400) {
    return new Error("failed to load org reporting line")
  }

  return response.json()
}
