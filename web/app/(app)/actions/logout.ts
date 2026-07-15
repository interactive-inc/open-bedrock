"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

// ログアウト Server Action。
// 1. サーバー側でリフレッシュトークンのファミリーを失効させる
// 2. クライアント側の cookie を破棄する
// 3. ログイン画面へリダイレクトする
// API 呼び出しが失敗してもクライアント側のログアウトは必ず実行する。
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get("refresh_token")?.value

  if (refreshToken !== undefined) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"

      await fetch(`${baseUrl}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
    } catch {
      // API failure must not block client-side logout
    }
  }

  cookieStore.delete("session")

  cookieStore.delete("refresh_token")

  redirect("/login")
}
