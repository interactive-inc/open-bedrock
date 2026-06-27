import { createClient } from "@/lib/api/hc-client"

// DELETE /roles/:id。動的ロールを削除する（iam:manage_roles が必要）。
export async function deleteRole(roleId: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.roles[":id"].$delete({
    param: { id: String(roleId) },
  })

  if (response.status >= 400) {
    return new Error("failed to delete role")
  }

  return null
}
