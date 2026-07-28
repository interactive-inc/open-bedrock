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
 * Build a Content-Security-Policy value with a per-request nonce.
 *
 * In development Turbopack uses eval, so 'unsafe-eval' is added to script-src.
 * 'strict-dynamic' propagates trust from the nonced bootstrap script to dynamically
 * loaded chunks, so explicit host allowlists are unnecessary.
 */
function buildCsp(nonce: string): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(process.env.NODE_ENV === "development" ? ["'unsafe-eval'"] : []),
  ].join(" ")

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join("; ")
}

/**
 * Create a NextResponse.next() with the nonce-based CSP set on both the
 * forwarded request headers (so Next.js can read the nonce and stamp inline
 * scripts) and the response headers (so the browser enforces the policy).
 */
function nextWithCsp(request: NextRequest, nonce: string, csp: string): NextResponse {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("content-security-policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set("content-security-policy", csp)

  return response
}

/**
 * access token cookie が無い場合は refresh token を1回だけローテーションし、
 * 新しい session を同じ URL のリクエストへ注入する。
 * 認証できない場合もリダイレクトせず、API の AuthError を error boundary まで伝播させる。
 * Next 16 の proxy.ts(Node runtime)は OpenNext Cloudflare 未対応のため、
 * Edge で動く middleware.ts 記法を維持する。
 *
 * Every page-rendering response carries a per-request nonce-based CSP so that
 * Next.js can stamp its inline scripts while the browser blocks un-nonced ones.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const nonce = crypto.randomUUID()
  const csp = buildCsp(nonce)

  const sessionCookie = request.cookies.get("session")

  const refreshTokenCookie = request.cookies.get("refresh_token")

  if (sessionCookie !== undefined) {
    return nextWithCsp(request, nonce, csp)
  }

  if (refreshTokenCookie === undefined) {
    return nextWithCsp(request, nonce, csp)
  }

  const refreshed = await deduplicatedRefresh(refreshTokenCookie.value)

  if (refreshed instanceof Error) {
    const response = nextWithCsp(request, nonce, csp)

    response.cookies.delete("session")
    response.cookies.delete("refresh_token")

    return response
  }

  request.cookies.set("session", refreshed.access_token)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("content-security-policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set("content-security-policy", csp)

  setSessionCookies({
    cookieStore: response.cookies,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
  })

  return response
}
