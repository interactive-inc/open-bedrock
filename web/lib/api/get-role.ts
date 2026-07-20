import { createClient } from "@/lib/api/hc-client"

/** GET /roles/:id。ロール詳細（割当済み permission キー付き、iam:manage_roles が必要）。 */
export async function getRole(roleId: number) {
  const client = await createClient()

  const response = await client.roles[":id"].$get({
    param: { id: String(roleId) },
  })

  if (response.status >= 400) {
    return new Error("failed to load role")
  }

  return response.json()
}
