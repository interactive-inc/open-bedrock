import { getServerSession } from "@/lib/auth/get-server-session"
import { type ApiClient, hcWithType } from "api/app"

// ネットワーク失敗（接続拒否・DNS 失敗・タイムアウト）を 503 Response に変換する。
// hc は fetch の例外をそのまま投げ、未ハンドル例外が Next.js に伝播して汎用 500 になる。
// 503 に変換することで各 API 関数の status/ok 判定に乗り、Error として扱える。
// 変換するのはネットワーク失敗（fetch は TypeError を投げる）のみ。不正 URL 等の
// プログラミングエラーまで 503 に握り潰さないよう、それ以外は再 throw する。
const fetchWithNetworkGuard: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init)
  } catch (error) {
    if (error instanceof TypeError) {
      return Response.json({ error: "api unreachable" }, { status: 503 })
    }

    throw error
  }
}

// api 側で hc の型計算を済ませた hcWithType ファクトリを使う。
// これにより HonoBase の schema 抽出が効き、レスポンス型が正しく推論される。
export async function createClient(): Promise<ApiClient> {
  const token = await getServerSession()

  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"

  const headers: Record<string, string> = {}

  if (token !== null) {
    headers.Authorization = `Bearer ${token}`
  }

  return hcWithType(baseUrl, { headers, fetch: fetchWithNetworkGuard })
}

export type Client = ApiClient
