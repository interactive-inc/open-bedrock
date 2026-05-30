import { LoginForm } from "@/app/(auth)/login/login-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// /login 画面の RSC ラッパ。フォーム本体は Client Component に委譲する。
export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>open-karte にサインイン</CardTitle>

          <CardDescription>
            アカウントのメールアドレスとパスワードを入力してください
          </CardDescription>
        </CardHeader>

        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  )
}
