"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { postLogin } from "@/lib/api/post-login"
import { sessionMaxAge } from "@/lib/auth/session-max-age"
import { getTranslator } from "@/lib/i18n/get-translator"

export type LoginState = {
  ok: boolean
  error: string | null
}

/**
 * ログインフォームの Server Action。`useActionState` から呼ばれる。
 * 成功時は session cookie を立てて `/` へ redirect する。
 */
export async function loginAction(
  previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const t = await getTranslator()

  const email = formData.get("email")

  const password = formData.get("password")

  if (typeof email !== "string" || typeof password !== "string") {
    return { ok: false, error: t("メールアドレスとパスワードを入力してください") }
  }

  const result = await postLogin({ email, password })

  if (result instanceof Error) {
    return { ok: false, error: t("メールアドレスまたはパスワードが正しくありません") }
  }

  const cookieStore = await cookies()

  cookieStore.set("session", result.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAge(result.access_token),
  })

  if (result.refresh_token !== null) {
    cookieStore.set("refresh_token", result.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    })
  }

  redirect("/")
}
