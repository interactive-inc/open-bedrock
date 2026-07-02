"use server"

import { cookies } from "next/headers"
import { localeCookieName, zLocale } from "@/lib/i18n/locale"

export type SetLocaleState = {
  ok: boolean
  error: string | null
}

/**
 * 設定画面の言語切替 Server Action。`useActionState` から呼ばれる。
 * cookie に選択言語を保存する。画面への反映は呼び出し側の `router.refresh()` に任せる。
 */
export async function setLocaleAction(
  _previousState: SetLocaleState,
  formData: FormData,
): Promise<SetLocaleState> {
  const locale = zLocale.parse(formData.get("locale"))

  const cookieStore = await cookies()

  cookieStore.set(localeCookieName, locale, {
    path: "/",
    maxAge: 31536000,
  })

  return { ok: true, error: null }
}
