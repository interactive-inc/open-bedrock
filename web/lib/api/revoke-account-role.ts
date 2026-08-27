import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"

/** DELETE /system/accounts/:accountId/role-bindings/:bindingId。System Role を剥奪する。 */
export async function revokeAccountRole(
  accountId: string,
  bindingId: string,
): Promise<null | Error> {
  const client = await createClient()

  const response = await client.system.accounts[":accountId"]["role-bindings"][
    ":bindingId"
  ].$delete({
    param: { accountId, bindingId },
  })

  if (response.status !== 204) {
    return await toApiResponseError(response, "failed to revoke role")
  }

  return null
}
