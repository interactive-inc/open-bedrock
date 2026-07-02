"use client"

import { LoginForm } from "@/components/login-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslator } from "@/lib/i18n/use-translator"

/**
 * 未認証時に error boundary から差し替えで描画するログイン画面。
 * 画面全体を覆い、サインインしたら Server Action が `/` へ redirect する。
 *
 * `app/(auth)/login/page.tsx`（Server Component）と `error.tsx`（Next.js の規約で必ず
 * Client Component）の両方から直接 import されるため、ここは Client Component にして
 * root layout の `TranslatorProvider` から `t` を受け取る（async Server Component +
 * `next/headers` にすると error.tsx 側の build が壊れるため不可）。
 */
export function LoginGate() {
  const t = useTranslator()

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("open-karte にサインイン")}</CardTitle>

          <CardDescription>
            {t("アカウントのメールアドレスとパスワードを入力してください。")}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  )
}
