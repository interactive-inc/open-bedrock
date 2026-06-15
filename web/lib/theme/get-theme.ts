import { cookies } from "next/headers"

export type Theme = "light" | "dark"

/**
 * クッキーから現在のテーマを取得する。指定が無ければ `light` を返す。
 * `<html class>` を SSR で設定するために RSC から呼ぶ。
 */
export async function getTheme(): Promise<Theme> {
  const cookieStore = await cookies()

  const stored = cookieStore.get("theme")

  if (stored?.value === "dark") return "dark"

  return "light"
}
