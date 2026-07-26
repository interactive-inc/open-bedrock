"use client"

import { LoginForm } from "@/components/login-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslator } from "@/lib/i18n/use-translator"

type Props = {
  onAuthenticated: () => void
}

/**
 * AuthError を受けた root error boundary が、現在の URL のまま表示するログイン画面。
 * サインイン後は boundary を reset して同じページを再描画する。
 *
 * ビルド時環境変数でログイン手段を出し分ける:
 * - NEXT_PUBLIC_IDENTITY_LOGIN_URL … 設定時、外部 identity provider への
 *   ログインボタンを表示する
 * - NEXT_PUBLIC_PASSWORD_LOGIN_HIDDEN="1" … パスワードフォームを隠す。
 *   ただし NEXT_PUBLIC_IDENTITY_LOGIN_URL が無い場合はロックアウト防止のため隠さない
 * - NEXT_PUBLIC_LOGIN_HIDDEN="1" … フォームもボタンも出さずタイトルだけ表示する。
 *   ログインを CLI など別経路に限定するデプロイ向け。タイトルは NEXT_PUBLIC_APP_NAME
 */
export function LoginPage(props: Props) {
  const t = useTranslator()

  const loginHidden = process.env.NEXT_PUBLIC_LOGIN_HIDDEN === "1"

  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? null

  const identityLoginUrl = process.env.NEXT_PUBLIC_IDENTITY_LOGIN_URL ?? null

  const passwordLoginHidden =
    process.env.NEXT_PUBLIC_PASSWORD_LOGIN_HIDDEN === "1" && identityLoginUrl !== null

  if (loginHidden) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-muted/40 p-6">
        <span className="text-2xl font-semibold tracking-widest">
          {appName ?? t("open-karte にサインイン")}
        </span>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("open-karte にサインイン")}</CardTitle>

          <CardDescription>
            {passwordLoginHidden
              ? t("組織のアカウントでログインしてください。")
              : t("アカウントのメールアドレスとパスワードを入力してください。")}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {passwordLoginHidden === false ? (
            <LoginForm onAuthenticated={props.onAuthenticated} />
          ) : null}

          {identityLoginUrl !== null ? (
            <Button nativeButton={false} render={<a href={identityLoginUrl} />}>
              {t("ログインする")}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
