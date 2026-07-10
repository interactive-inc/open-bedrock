import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { postRefreshToken } from "@/lib/api/post-refresh-token"
import { setSessionCookies } from "@/lib/auth/set-session-cookies"

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}

/**
 * 未認証の保護画面アクセスはログイン画面へ送り、access token cookie が無い場合は
 * refresh token を1回だけローテーションしてから元のリクエストを続行する。
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const isLoginPage = request.nextUrl.pathname === "/login"

  const sessionCookie = request.cookies.get("session")

  const refreshTokenCookie = request.cookies.get("refresh_token")

  if (sessionCookie !== undefined) {
    return isLoginPage ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next()
  }

  if (refreshTokenCookie === undefined) {
    return isLoginPage ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url))
  }

  if (isLoginPage) {
    const refreshed = await postRefreshToken(refreshTokenCookie.value)

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

  const refreshed = await postRefreshToken(refreshTokenCookie.value)

  if (refreshed instanceof Error) {
    const response = NextResponse.redirect(new URL("/login", request.url))

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
