import { createClient } from "@/lib/api/hc-client"

// GET /me を session トークン付きで呼び、認証済みの本人情報を取得する。
// 401/403（未認証・権限なし）は Error を返し、呼び出し側（layout）が /login への
// リダイレクトに使う。それ以外の失敗（API 到達不能による 503 やサーバエラー）は
// throw してエラーバウンダリに落とす。ここで Error を返すと layout が /login へ
// リダイレクト → proxy がセッション有りで /dashboard へ戻す、の無限ループになるため。
export async function getMe() {
  const client = await createClient()

  const response = await client.me.$get()

  if (response.status === 401 || response.status === 403) {
    return new Error("unauthorized")
  }

  if (response.status >= 400) {
    throw new Error(`failed to load me (${response.status})`)
  }

  return response.json()
}
