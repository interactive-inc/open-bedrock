import { createClient } from "@/lib/api/hc-client"

// POST /accounts/:id/status。アカウントの状態を変更する（account:manage が必要）。
export async function setAccountStatus(
  accountId: number,
  status: "active" | "suspended" | "locked",
): Promise<null | Error> {
  const client = await createClient()

  const response = await client.accounts[":id"].status.$post({
    param: { id: String(accountId) },
    json: { status: status },
  })

  if (response.status >= 400) {
    return new Error("failed to set account status")
  }

  return null
}
