"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { postLogin } from "@/lib/api/post-login"
import { sessionMaxAge } from "@/lib/auth/session-max-age"

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
  const email = formData.get("email")

  const password = formData.get("password")

  if (typeof email !== "string" || typeof password !== "string") {
    return { ok: false, error: "メールアドレスとパスワードを入力してください" }
  }

  const result = await postLogin({ email, password })

  if (result instanceof Error) {
    return { ok: false, error: "メールアドレスまたはパスワードが正しくありません" }
  }

  const cookieStore = await cookies()

  cookieStore.set("session", result.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAge(result.access_token),
  })

  redirect("/")
}
