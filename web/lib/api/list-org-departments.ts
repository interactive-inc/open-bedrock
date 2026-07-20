import { createClient } from "@/lib/api/hc-client"
import type { OrgDepartmentResponse } from "@/lib/api/types/org-types"

/** GET /org/departments。組織図の部署ノードを表示順で返す。 */
export async function listOrgDepartments(): Promise<ReadonlyArray<OrgDepartmentResponse> | Error> {
  const client = await createClient()

  const response = await client.org.departments.$get()

  if (response.status >= 400) {
    return new Error("failed to load org departments")
  }

  return response.json()
}
