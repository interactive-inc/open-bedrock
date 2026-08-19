import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"

/** POST /accounts/:id/status。アカウントの状態を変更する（account:manage が必要）。 */
export async function setAccountStatus(
  accountId: string,
  status: "active" | "suspended" | "locked",
): Promise<null | Error> {
  const client = await createClient()

  const response = await client.accounts[":id"].status.$post({
    param: { id: accountId },
    json: { status: status },
  })

  if (response.status >= 400) {
    return await toApiResponseError(response, "failed to set account status")
  }

  return null
}
