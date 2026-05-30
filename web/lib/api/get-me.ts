import { createClient } from "@/lib/api/hc-client"

// GET /me を session トークン付きで呼び、認証済みの本人情報を取得する。
export async function getMe() {
  const client = await createClient()

  const response = await client.me.$get()

  if (response.status >= 400) {
    return new Error("failed to load me")
  }

  return response.json()
}
