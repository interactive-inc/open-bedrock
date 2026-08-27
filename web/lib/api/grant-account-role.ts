import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"

/** POST /system/accounts/:accountId/role-bindings。System Role を付与する。 */
export async function grantAccountRole(accountId: string, roleId: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client.system.accounts[":accountId"]["role-bindings"].$post({
    param: { accountId },
    json: { role_id: roleId, resource: null },
  })

  if (response.status !== 201) {
    return await toApiResponseError(response, "failed to grant role")
  }

  return null
}
