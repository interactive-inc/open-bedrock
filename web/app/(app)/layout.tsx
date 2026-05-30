import { redirect } from "next/navigation"
import { logoutAction } from "@/app/(app)/actions/logout"
import { getMe } from "@/lib/api/get-me"
import { AppShell } from "@/components/app-shell"

type Props = {
  children: React.ReactNode
}

// 保護済みページ共通の layout。/me で本人を取得し、未認証なら /login へ戻す。
// 取得した本人情報と logout Server Action を AppShell (Client) に渡す。
export default async function AppLayout(props: Props) {
  const currentUser = await getMe()

  if (currentUser instanceof Error) {
    redirect("/login")
  }

  return (
    <AppShell currentUser={currentUser} onLogout={logoutAction}>
      {props.children}
    </AppShell>
  )
}
