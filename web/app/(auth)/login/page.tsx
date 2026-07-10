import { LoginGate } from "@/components/login-gate"

export const metadata = { title: "ログイン" }

// 未認証ユーザー専用のログイン画面。認証済みの場合は middleware がホームへ戻す。
export default function LoginPage() {
  return <LoginGate />
}
