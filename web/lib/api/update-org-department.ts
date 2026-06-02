import { createClient } from "@/lib/api/hc-client"
import type { OrgDepartmentResponse, OrgDepartmentUpdateRequest } from "@/lib/api/types/org-types"

// PUT /org/departments/:code。部署ノードの親・責任者・表示順を変更する。
// 権限不足は 403、不存在は 404、自身を親にすると 409 を api が返すため Error。
export async function updateOrgDepartment(
  code: string,
  request: OrgDepartmentUpdateRequest,
): Promise<OrgDepartmentResponse | Error> {
  const client = await createClient()

  const response = await client.org.departments[":code"].$put({
    param: { code },
    json: request,
  })

  if (response.status >= 400) {
    return new Error("failed to update org department")
  }

  return response.json()
}
