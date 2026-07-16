"use client"

import { LoginForm } from "@/components/login-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslator } from "@/lib/i18n/use-translator"

/**
 * 未認証時に保護領域の layout（または認証切れ時の error boundary）から描画するログイン画面。
 * 画面全体を覆い、サインインしたら Server Action が `/` へ redirect する。
 * error.tsx（Next.js の規約で必ず Client Component）から import されるため Client Component。
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
