import { createClient } from "@/lib/api/hc-client"

/** GET /department-definitions。部署マスタ一覧を取得する。誰でも参照できる公開情報。 */
export async function getDepartmentDefinitionList() {
  const client = await createClient()

  const response = await client["department-definitions"].$get()

  if (response.status >= 400) {
    return new Error("failed to load department definitions")
  }

  const body = await response.json()

  return body.data
}
