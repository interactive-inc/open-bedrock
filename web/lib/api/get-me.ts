import { createClient } from "@/lib/api/hc-client"

// GET /me を session トークン付きで呼び、認証済みの本人情報を取得する。
// 401/403（未認証・権限なし）は Error を返し、呼び出し側（layout）が /login への
// リダイレクトに使う。それ以外の失敗（API 到達不能による 503 やサーバエラー）は
// throw してエラーバウンダリに落とす。ここで Error を返すと layout が /login へ
// リダイレクト → proxy がセッション有りで /dashboard へ戻す、の無限ループになるため。
export async function getMe() {
  const client = await createClient()

  const response = await client.me.$get()

  // hc の型では status が成功コードのリテラル(200)になり === 401/403 が TS2367 になるため、
  // 実行時の実値を見るよう number に広げてから判定する。
  const status: number = response.status

  if (status === 401 || status === 403) {
    return new Error("unauthorized")
  }

  if (status >= 400) {
    throw new Error(`failed to load me (${status})`)
  }

  return response.json()
}
