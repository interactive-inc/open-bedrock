import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { postRefreshToken } from "@/lib/api/post-refresh-token"
import { setSessionCookies } from "@/lib/auth/set-session-cookies"

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}

// Mutex for refresh token rotation — prevents concurrent requests from triggering
// simultaneous refreshes that cause token conflicts and unexpected logouts.
let inflightRefresh: Promise<Awaited<ReturnType<typeof postRefreshToken>>> | null = null

function deduplicatedRefresh(
  refreshToken: string,
): Promise<Awaited<ReturnType<typeof postRefreshToken>>> {
  if (inflightRefresh !== null) {
    return inflightRefresh
  }
  inflightRefresh = postRefreshToken(refreshToken).finally(() => {
    inflightRefresh = null
  })
  return inflightRefresh
}

/**
 * 未認証の保護画面アクセスはログイン画面へ送り、access token cookie が無い場合は
 * refresh token を1回だけローテーションしてから元のリクエストを続行する。
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const isLoginPage = request.nextUrl.pathname === "/login"
  // CSV proxy is an HTTP endpoint, not a page. Its Route Handler must preserve the API's
  // 401 JSON/no-store contract instead of turning failures into an HTML login redirect.
  const isAuditExportRoute = request.nextUrl.pathname === "/admin/audit-events/export"

  const sessionCookie = request.cookies.get("session")

  const refreshTokenCookie = request.cookies.get("refresh_token")

  if (sessionCookie !== undefined) {
    return isLoginPage ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next()
  }

  if (refreshTokenCookie === undefined) {
    return isLoginPage || isAuditExportRoute
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/login", request.url))
  }

  if (isLoginPage) {
    const refreshed = await deduplicatedRefresh(refreshTokenCookie.value)

    if (refreshed instanceof Error) {
      const response = NextResponse.next()

      response.cookies.delete("session")
      response.cookies.delete("refresh_token")

      return response
    }

    const response = NextResponse.redirect(new URL("/", request.url))

    setSessionCookies({
      cookieStore: response.cookies,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
    })

    return response
  }

  const refreshed = await deduplicatedRefresh(refreshTokenCookie.value)

  if (refreshed instanceof Error) {
    const response = isAuditExportRoute
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/login", request.url))

    response.cookies.delete("session")
    response.cookies.delete("refresh_token")

    return response
  }

  request.cookies.set("session", refreshed.access_token)

  const response = NextResponse.next({ request })

  setSessionCookies({
    cookieStore: response.cookies,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
  })

  return response
}
