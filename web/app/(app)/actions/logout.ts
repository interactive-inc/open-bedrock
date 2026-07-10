"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

// ログアウト Server Action。session cookie を破棄してログイン画面へ戻す。
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies()

  cookieStore.delete("session")

  cookieStore.delete("refresh_token")

  redirect("/login")
}
