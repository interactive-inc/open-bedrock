import { createClient } from "@/lib/api/hc-client"

/** GET /system/v1/roles。System Role 一覧を取得する。 */
export async function getRoles() {
  const client = await createClient()

  const response = await client.system.v1.roles.$get()

  if (response.status !== 200) {
    return new Error("failed to load roles")
  }

  const body = await response.json()

  return body.roles.map((role) => ({
    ...role,
    is_system: role.kind === "managed",
  }))
}
