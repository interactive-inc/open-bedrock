import { createClient } from "@/lib/api/hc-client"

// POST /accounts/:id/reset-password。管理者がアカウントのパスワードを再設定する（account:manage が必要）。
export async function resetAccountPassword(
  accountId: number,
  newPassword: string,
): Promise<null | Error> {
  const client = await createClient()

  const response = await client.accounts[":id"]["reset-password"].$post({
    param: { id: String(accountId) },
    json: { new_password: newPassword },
  })

  if (response.status >= 400) {
    return new Error("failed to reset password")
  }

  return null
}
