import { logoutAction } from "@/app/(app)/actions/logout"
import { AppShell } from "@/components/app-shell"
import { AuthProvider } from "@/components/auth-provider"
import { getMe } from "@/lib/api/get-me"
import { getMyUnreadCount } from "@/lib/api/get-my-unread-count"
import { getTheme } from "@/lib/theme/get-theme"

type Props = {
  children: React.ReactNode
}

/**
 * 保護領域共通の layout。`getMe` で本人を取得し、未認証なら `AuthError` を throw して
 * error boundary がログインフォームに差し替える。
 * 取得した本人と未読件数を AppShell に渡し、AuthProvider 経由で配下からも参照できるようにする。
 */
export default async function AppLayout(props: Props) {
  const currentUser = await getMe()

  // 未読数バッジは補助情報なので、取得失敗時はページ描画を止めず 0 にフォールバックする
  // （意図的なグレースフルデグレード）。
  const unreadCount = await getMyUnreadCount()

  const unreadNotificationCount = unreadCount instanceof Error ? 0 : unreadCount.count

  const theme = await getTheme()

  return (
    <AuthProvider currentUser={currentUser}>
      <AppShell
        currentUser={currentUser}
        onLogout={logoutAction}
        unreadNotificationCount={unreadNotificationCount}
        theme={theme}
      >
        {props.children}
      </AppShell>
    </AuthProvider>
  )
}
