import { logoutAction } from "@/app/(app)/actions/logout"
import { AppShell } from "@/components/app-shell"
import { AuthProvider } from "@/components/auth-provider"
import { getMe } from "@/lib/api/get-me"
import { getInboxCounts } from "@/lib/api/get-inbox-counts"
import { getMyDepartments } from "@/lib/api/get-my-departments"
import { getOrgTree } from "@/lib/api/get-org-tree"
import { getMyUnreadCount } from "@/lib/api/get-my-unread-count"
import { getLocale } from "@/lib/i18n/get-locale"
import { flattenOrgTree } from "@/lib/org/flatten-org-tree"

type Props = {
  children: React.ReactNode
}

/**
 * 保護領域共通の layout。`getMe` で本人を取得し、未認証なら `AuthError` を
 * root error boundary まで伝播させる。
 * 取得した本人と未読件数を AppShell に渡し、AuthProvider 経由で配下からも参照できるようにする。
 */
export default async function AppLayout(props: Props) {
  const currentUser = await getMe()

  // 未読数・受信箱件数バッジは補助情報なので、取得失敗時はページ描画を止めず 0 にフォールバックする
  // （意図的なグレースフルデグレード）。
  const [unreadCount, inboxCountsResult, locale, myDepartmentsResult, orgTreeResult] =
    await Promise.all([
      getMyUnreadCount(),
      getInboxCounts(),
      getLocale(),
      getMyDepartments(),
      getOrgTree(),
    ])

  const unreadNotificationCount = unreadCount instanceof Error ? 0 : unreadCount.count

  const inboxCounts =
    inboxCountsResult instanceof Error
      ? { applications: 0, expenses: 0, leaves: 0, shifts: 0, thanks: 0 }
      : inboxCountsResult

  const myDepartments = myDepartmentsResult instanceof Error ? [] : myDepartmentsResult

  const allDepartments = orgTreeResult instanceof Error ? [] : flattenOrgTree(orgTreeResult)

  return (
    <AuthProvider currentUser={currentUser}>
      <AppShell
        currentUser={currentUser}
        inboxCounts={inboxCounts}
        myDepartments={myDepartments}
        allDepartments={allDepartments}
        locale={locale}
        onLogout={logoutAction}
        unreadNotificationCount={unreadNotificationCount}
      >
        {props.children}
      </AppShell>
    </AuthProvider>
  )
}
