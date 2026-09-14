import { logoutAction } from "@/app/(app)/actions/logout"
import { AppShell } from "@/components/app-shell"
import { AuthProvider } from "@/components/auth-provider"
import { FetchError } from "@/components/fetch-error"
import { LoginPage } from "@/components/login-page"
import { isAuthError } from "@/lib/api/auth-error"
import { getFeatureAvailability } from "@/lib/api/get-feature-availability"
import { getMe } from "@/lib/api/get-me"
import { getLocale } from "@/lib/i18n/get-locale"
import { unstable_rethrow } from "next/navigation"

type Props = {
  children: React.ReactNode
}

/**
 * 保護領域共通の layout。`getMe` で本人を取得し、未認証なら AppShell を描画せず
 * ログイン画面を正常応答として返す。
 * 管理セッションと機能ゲートを AppShell に渡す。
 */
export default async function AppLayout(props: Props) {
  let currentUser: Awaited<ReturnType<typeof getMe>>
  try {
    currentUser = await getMe()
  } catch (error) {
    unstable_rethrow(error)
    if (isAuthError(error)) {
      return <LoginPage />
    }
    throw error
  }

  const [locale, disabledFeatures] = await Promise.all([getLocale(), getFeatureAvailability()])
  if (disabledFeatures instanceof Error) return <FetchError message={disabledFeatures.message} />

  return (
    <AuthProvider currentUser={currentUser}>
      <AppShell
        currentUser={currentUser}
        locale={locale}
        onLogout={logoutAction}
        disabledFeatures={disabledFeatures}
      >
        {props.children}
      </AppShell>
    </AuthProvider>
  )
}
