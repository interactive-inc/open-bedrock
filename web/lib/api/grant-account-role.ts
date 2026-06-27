import { createClient } from "@/lib/api/hc-client"

// POST /accounts/:id/roles。アカウントにロールを付与する（iam:assign_roles が必要）。
export async function grantAccountRole(accountId: number, roleKey: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client.accounts[":id"].roles.$post({
    param: { id: String(accountId) },
    json: { role_key: roleKey },
  })

  if (response.status >= 400) {
    return new Error("failed to grant role")
  }

  return null
}
