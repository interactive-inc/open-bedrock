import { createClient } from "@/lib/api/hc-client"

/** GET /permission-definitions。権限カタログ全件（iam:manage_roles が必要）。ロール編集 UI の選択肢に使う。 */
export async function getPermissions() {
  const client = await createClient()

  const response = await client["permission-definitions"].$get()

  if (response.status >= 400) {
    return new Error("failed to load permissions")
  }

  const body = await response.json()

  return body.data
}
