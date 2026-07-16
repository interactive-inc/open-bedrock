import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"

// DELETE /accounts/:id/roles/:roleKey。アカウントからロールを剥奪する（iam:assign_roles が必要）。
export async function revokeAccountRole(accountId: number, roleKey: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client.accounts[":id"].roles[":roleKey"].$delete({
    param: { id: String(accountId), roleKey: roleKey },
  })

  if (response.status >= 400) {
    return await toApiResponseError(response, "failed to revoke role")
  }

  return null
}
