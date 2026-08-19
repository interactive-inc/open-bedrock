import { createClient } from "@/lib/api/hc-client"

/** DELETE /system/v1/roles/:roleId。custom System Role を削除する。 */
export async function deleteRole(roleId: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client.system.v1.roles[":roleId"].$delete({
    param: { roleId },
  })

  if (response.status !== 204) {
    return new Error("failed to delete role")
  }

  return null
}
