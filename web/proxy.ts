import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// 認証ガード。Next16 では middleware が proxy に改称された。
// session cookie が無ければ /login へ、ある状態で /login を踏んだら /dashboard へ送る。
// 判定は cookie の有無のみ（JWT 署名・exp は検証しない）。実際の認可は API と
// layout の getMe が担う。cookie の maxAge は JWT exp に同期しているので、失効時は
// cookie も送られず /login へ正しく落ちる。
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
  // 拡張子を含むパス（/public 配下の静的資産など）は認証ガードの対象外にする。
  // 従来は /next.svg のような資産まで /login へリダイレクトしていた。
  matcher: ["/((?!login$|_next|favicon\\.ico|.*\\.).*)", "/login"],
}
