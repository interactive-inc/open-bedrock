import { LoginForm } from "@/components/login-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * 未認証時に error boundary から差し替えで描画するログイン画面。
 * 画面全体を覆い、サインインしたら Server Action が `/` へ redirect する。
 */
export function LoginGate() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>open-karte にサインイン</CardTitle>

          <CardDescription>
            アカウントのメールアドレスとパスワードを入力してください。
          </CardDescription>
        </CardHeader>

        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  )
}
