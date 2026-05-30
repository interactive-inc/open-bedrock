import { getServerSession } from "@/lib/auth/get-server-session"
import type { ApiClient } from "api/app"
import { hc } from "hono/client"

// api 側で hc の型計算を済ませた ApiClient 型を使う。
// これにより HonoBase の schema 抽出が効き、レスポンス型が正しく推論される。
export async function createClient(): Promise<ApiClient> {
  const token = await getServerSession()

  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"

  const headers: Record<string, string> = {}

  if (token !== null) {
    headers.Authorization = `Bearer ${token}`
  }

  return hc(baseUrl, { headers }) as unknown as ApiClient
}

export type Client = ApiClient
