"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

// ログアウト Server Action。session cookie を破棄して `/` へ戻す。
// 認証なしで `/` にアクセスすると error boundary が LoginGate を表示する。
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies()

  cookieStore.delete("session")

  cookieStore.delete("refresh_token")

  redirect("/")
}
