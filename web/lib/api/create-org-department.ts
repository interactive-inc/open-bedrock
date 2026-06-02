import { createClient } from "@/lib/api/hc-client"
import type { OrgDepartmentCreateRequest, OrgDepartmentResponse } from "@/lib/api/types/org-types"

// POST /org/departments。部署ノードを作成する。権限不足は 403、コード重複は 409 で Error。
export async function createOrgDepartment(
  request: OrgDepartmentCreateRequest,
): Promise<OrgDepartmentResponse | Error> {
  const client = await createClient()

  const response = await client.org.departments.$post({
    json: request,
  })

  if (response.status >= 400) {
    return new Error("failed to create org department")
  }

  return response.json()
}
