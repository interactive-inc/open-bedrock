import { createClient } from "@/lib/api/hc-client"

// POST /roles。動的ロールを作成する（iam:manage_roles が必要）。
export async function createRole(request: {
  key: string
  name: string
  description: string | null
  permissionKeys: ReadonlyArray<string>
}) {
  const client = await createClient()

  const response = await client.roles.$post({
    json: {
      key: request.key,
      name: request.name,
      description: request.description,
      permission_keys: [...request.permissionKeys],
    },
  })

  if (response.status >= 400) {
    return new Error("failed to create role")
  }

  return response.json()
}
