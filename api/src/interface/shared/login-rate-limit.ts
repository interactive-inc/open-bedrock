import { factory } from "@/lib/factory"

// ログインエンドポイント向け IP ベースのレート制限ミドルウェア。
// Workers KV を使い、同一 IP から短時間に連続してリクエストが来た場合に 429 を返す。

const LIMIT = 5 // 同一ウィンドウ内の最大リクエスト数
const WINDOW_SECONDS = 60 // ウィンドウ幅（秒）。現在時刻をこの単位で丸める
const TTL_SECONDS = 900 // KV エントリの有効期限（15分）

// 現在時刻（秒）を WINDOW_SECONDS 単位で丸めたウィンドウ番号を返す。
function currentWindow(nowMs: number): number {
  return Math.floor(nowMs / 1000 / WINDOW_SECONDS)
}

export const loginRateLimitMiddleware = factory.createMiddleware(async (c, next) => {
  const kv = c.env.RATE_LIMIT

  // KV が未設定の環境（ローカル dev 等）はスキップする。
  if (kv === undefined) {
    return next()
  }

  const ip =
    c.req.header("CF-Connecting-IP") ??
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown"

  const window = currentWindow(Date.now())
  const key = `login:ip:${ip}:${window}`

  const raw = await kv.get(key)
  const count = raw !== null ? Number(raw) : 0

  if (count >= LIMIT) {
    return c.json({ error: "too many requests" }, 429)
  }

  await kv.put(key, String(count + 1), { expirationTtl: TTL_SECONDS })

  return next()
})
