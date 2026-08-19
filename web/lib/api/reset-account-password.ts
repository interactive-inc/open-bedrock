import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"

/** POST /accounts/:id/reset-password。管理者がアカウントのパスワードを再設定する（account:manage が必要）。 */
export async function resetAccountPassword(
  accountId: string,
  newPassword: string,
): Promise<null | Error> {
  const client = await createClient()

  const response = await client.accounts[":id"]["reset-password"].$post({
    param: { id: accountId },
    json: { new_password: newPassword },
  })

  if (response.status >= 400) {
    return await toApiResponseError(response, "failed to reset password")
  }

  return null
}
