import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// 認証ガード。Next16 では middleware が proxy に改称された。
// session cookie が無ければ /login へ、ある状態で /login を踏んだら /dashboard へ送る。
export function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get("session")

  const hasSession = sessionCookie !== undefined && sessionCookie.value !== ""

  const isLoginPath = request.nextUrl.pathname === "/login"

  if (isLoginPath) {
    if (hasSession) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    return NextResponse.next()
  }

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!login$|_next|favicon\\.ico).*)", "/login"],
}
