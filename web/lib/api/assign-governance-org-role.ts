import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"

export async function assignGovernanceOrgRole(input: {
  orgRoleCode: string
  employeeCode: string
  departmentCode: string | null
  startsOn: string
  endsOn: string | null
  sourceDocumentCode: string | null
}) {
  const client = await createClient()
  const response = await client["governance"]["governance-org-roles"][":code"].assignments.$post({
    param: { code: input.orgRoleCode },
    json: {
      employee_code: input.employeeCode,
      department_code: input.departmentCode,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      source_document_code: input.sourceDocumentCode,
    },
  })
  if (response.status >= 400) {
    return toApiResponseError(response, "組織ロールの割当に失敗しました")
  }
  return response.json()
}
