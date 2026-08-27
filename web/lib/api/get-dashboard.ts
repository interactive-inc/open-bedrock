import { createClient } from "@/lib/api/hc-client"

/** GET /dashboard を session トークン付きで呼び、横断サマリを取得する。 */
export async function getDashboard() {
  const client = await createClient()

  const response = await client["company"]["dashboard"].$get()

  if (response.status >= 400) {
    return new Error("failed to load dashboard")
  }

  return response.json()
}
