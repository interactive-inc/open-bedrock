import { createClient } from "@/lib/api/hc-client"

/** POST /system/roles。custom System Role を作成する。 */
export async function createRole(request: {
  key: string
  name: string
  description: string | null
  permissionKeys: ReadonlyArray<string>
}) {
  const client = await createClient()

  const response = await client.system.roles.$post({
    json: {
      key: request.key,
      name: request.name,
      description: request.description,
      permission_keys: [...request.permissionKeys],
    },
  })

  if (response.status !== 201) {
    return new Error("failed to create role")
  }

  return response.json()
}
