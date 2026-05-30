import { createClient } from "@/lib/api/hc-client"

// GET /leave/balance/me。当年度の自分の休暇残日数一覧を取得する。
export async function getLeaveBalanceMe() {
  const client = await createClient()

  const response = await client.leave.balance.me.$get()

  if (response.status >= 400) {
    return new Error("failed to load leave balance")
  }

  return response.json()
}
