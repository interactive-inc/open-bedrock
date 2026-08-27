import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"

/** PATCH /system/accounts/:accountId。System Account の状態を変更する。 */
export async function setAccountStatus(
  accountId: string,
  status: "active" | "suspended" | "locked",
): Promise<null | Error> {
  const client = await createClient()

  const response = await client.system.accounts[":accountId"].$patch({
    param: { accountId },
    json: { status: status },
  })

  if (response.status !== 200) {
    return await toApiResponseError(response, "failed to set account status")
  }

  return null
}
