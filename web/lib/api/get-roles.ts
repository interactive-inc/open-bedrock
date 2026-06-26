import { createClient } from "@/lib/api/hc-client"

// GET /roles。ロール一覧（iam:manage_roles が必要）。
export async function getRoles() {
  const client = await createClient()

  const response = await client.roles.$get()

  if (response.status >= 400) {
    return new Error("failed to load roles")
  }

  const body = await response.json()

  return body.data
}
