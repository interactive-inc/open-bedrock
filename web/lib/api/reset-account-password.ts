import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"

/** PATCH /system/accounts/:accountId/password-credentials。パスワードを再設定する。 */
export async function resetAccountPassword(
  accountId: string,
  newPassword: string,
): Promise<null | Error> {
  const client = await createClient()

  const response = await client.system.accounts[":accountId"]["password-credentials"].$patch({
    param: { accountId },
    json: { password: newPassword },
  })

  if (response.status !== 204) {
    return await toApiResponseError(response, "failed to reset password")
  }

  return null
}
