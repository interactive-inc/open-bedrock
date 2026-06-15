"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

/**
 * テーマ切替の Server Action。現在の cookie を見て反転させ、再描画する。
 * 1 年保持してパスは全体に。
 */
export async function toggleThemeAction() {
  const cookieStore = await cookies()

  const current = cookieStore.get("theme")?.value

  const next = current === "dark" ? "light" : "dark"

  cookieStore.set("theme", next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })

  revalidatePath("/", "layout")
}
