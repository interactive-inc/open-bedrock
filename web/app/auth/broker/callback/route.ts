import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { postIdentityLogin } from "@/lib/api/post-identity-login"
import { setSessionCookies } from "@/lib/auth/set-session-cookies"

/**
 * 外部 identity provider（SSO ブローカー）からの戻り先。
 * query の token をサーバーサイドで api に渡して検証・交換し、session cookie を
 * 立ててトップへリダイレクトする。token はここで使い切り（60 秒・一回限り）、
 * クライアント JS には渡さない。リダイレクトで URL からも消える。
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token")

  if (token === null || token === "") {
    return redirectToError(request, "missing_token")
  }

  const loginResult = await postIdentityLogin({ token })

  if (loginResult instanceof Error) {
    const reason = loginResult.message === "account_not_found" ? "account_not_found" : "login_failed"

    return redirectToError(request, reason)
  }

  const response = NextResponse.redirect(new URL("/", requestOrigin(request)))

  setSessionCookies({
    cookieStore: response.cookies,
    accessToken: loginResult.access_token,
    refreshToken: loginResult.refresh_token,
  })

  return response
}

/**
 * リバースプロキシ背後では nextUrl.origin が内部ポートを指すため、
 * x-forwarded-host / x-forwarded-proto を優先して外向きの origin を組み立てる
 */
function requestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host")

  if (forwardedHost === null) {
    return request.nextUrl.origin
  }

  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https"

  return `${forwardedProto}://${forwardedHost}`
}

function redirectToError(request: NextRequest, reason: string): NextResponse {
  const url = new URL("/auth/broker/error", requestOrigin(request))
  url.searchParams.set("reason", reason)

  return NextResponse.redirect(url)
}
