import { createClient } from "@/lib/api/hc-client"

/** PATCH /roles/:id。ロールの名前・説明・権限を更新する（iam:manage_roles が必要）。 */
export async function updateRole(
  roleId: number,
  request: {
    name: string
    description: string | null
    permissionKeys: ReadonlyArray<string>
  },
): Promise<null | Error> {
  const client = await createClient()

  const response = await client.roles[":id"].$patch({
    param: { id: String(roleId) },
    json: {
      name: request.name,
      description: request.description,
      permission_keys: [...request.permissionKeys],
    },
  })

  if (response.status >= 400) {
    return new Error("failed to update role")
  }

  return null
}
