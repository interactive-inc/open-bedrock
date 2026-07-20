import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { postRefreshToken } from "@/lib/api/post-refresh-token"
import { setSessionCookies } from "@/lib/auth/set-session-cookies"

export const config = {
  matcher: ["/((?!monitoring|_next/static|_next/image|favicon.ico).*)"],
}

/**
 * Mutex for refresh token rotation — prevents concurrent requests from triggering
 * simultaneous refreshes that cause token conflicts and unexpected logouts.
 */
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
 * access token cookie が無い場合は refresh token を1回だけローテーションし、
 * 新しい session を同じ URL のリクエストへ注入する。
 * 認証できない場合もリダイレクトせず、API の AuthError を error boundary まで伝播させる。
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const sessionCookie = request.cookies.get("session")

  const refreshTokenCookie = request.cookies.get("refresh_token")

  if (sessionCookie !== undefined) {
    return NextResponse.next()
  }

  if (refreshTokenCookie === undefined) {
    return NextResponse.next()
  }

  const refreshed = await deduplicatedRefresh(refreshTokenCookie.value)

  if (refreshed instanceof Error) {
    const response = NextResponse.next()

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
