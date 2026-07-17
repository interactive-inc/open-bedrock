import { createClient } from "@/lib/api/hc-client"

// GET /me/reports を session トークン付きで呼び、本人の直属部下一覧を返す。
export async function getMyReports() {
  const client = await createClient()

  const response = await client.me.reports.$get()

  if (response.status >= 400) {
    return new Error("failed to load my reports")
  }

  return response.json()
}
