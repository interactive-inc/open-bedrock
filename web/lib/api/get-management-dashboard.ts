import { createClient } from "@/lib/api/hc-client"

// GET /dashboard/management を session トークン付きで呼び、経営ダッシュボードの集計を取得する。
export async function getManagementDashboard() {
  const client = await createClient()

  const response = await client.dashboard.management.$get()

  if (response.status >= 400) {
    return new Error("failed to load management dashboard")
  }

  return response.json()
}
