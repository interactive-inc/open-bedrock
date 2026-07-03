import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { postRefreshToken } from "@/lib/api/post-refresh-token"
import { setSessionCookies } from "@/lib/auth/set-session-cookies"

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}

/**
 * access token（`session` cookie）が失効している間だけ、`refresh_token` で裏側から
 * 再発行する。session が残っている通常時は素通りする。
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const sessionCookie = request.cookies.get("session")

  const refreshTokenCookie = request.cookies.get("refresh_token")

  if (sessionCookie !== undefined || refreshTokenCookie === undefined) {
    return NextResponse.next()
  }

  const refreshed = await postRefreshToken(refreshTokenCookie.value)

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
