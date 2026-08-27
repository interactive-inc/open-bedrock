import { createClient } from "@/lib/api/hc-client"

/** PATCH /system/roles/:roleId。custom System Role を更新する。 */
export async function updateRole(
  roleId: string,
  request: {
    name: string
    description: string | null
    permissionKeys: ReadonlyArray<string>
  },
): Promise<null | Error> {
  const client = await createClient()

  const response = await client.system.roles[":roleId"].$patch({
    param: { roleId },
    json: {
      name: request.name,
      description: request.description,
      permission_keys: [...request.permissionKeys],
    },
  })

  if (response.status !== 200) {
    return new Error("failed to update role")
  }

  return null
}
