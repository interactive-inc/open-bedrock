"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

// ログアウト Server Action。session cookie を破棄して /login へ戻す。
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies()

  cookieStore.delete("session")

  redirect("/login")
}
