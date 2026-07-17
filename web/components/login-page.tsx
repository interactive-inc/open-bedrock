"use client"

import { LoginForm } from "@/components/login-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslator } from "@/lib/i18n/use-translator"

type Props = {
  onAuthenticated: () => void
}

/**
 * AuthError を受けた root error boundary が、現在の URL のまま表示するログイン画面。
 * サインイン後は boundary を reset して同じページを再描画する。
 */
export function LoginPage(props: Props) {
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
          <LoginForm onAuthenticated={props.onAuthenticated} />
        </CardContent>
      </Card>
    </div>
  )
}
