import { NextResponse } from "next/server"

import { createPkce } from "@/lib/auth/create-pkce"
import { identityLoginCookieNames } from "@/lib/auth/identity-login-cookie-names"
import { isSecureIdentityIssuer } from "@/lib/auth/is-secure-identity-issuer"

/**
 * 外部identityログインを開始し、stateとPKCE verifierをHTTP-only Cookieへ保存する。
 */
export async function GET(): Promise<NextResponse> {
  const identityLoginUrl = process.env.IDENTITY_LOGIN_URL
  const redirectUri = process.env.IDENTITY_REDIRECT_URI
  if (!identityLoginUrl || !redirectUri) {
    return NextResponse.json({ error: "identity login is not configured" }, { status: 503 })
  }

  let brokerUrl: URL
  let callbackUrl: URL
  try {
    brokerUrl = new URL(identityLoginUrl)
    callbackUrl = new URL(redirectUri)
  } catch {
    return NextResponse.json({ error: "identity login is not configured" }, { status: 503 })
  }
  if (!isSecureIdentityIssuer(brokerUrl) || !isSecureIdentityIssuer(callbackUrl)) {
    return NextResponse.json({ error: "identity login is not configured" }, { status: 503 })
  }

  const state = crypto.randomUUID()
  const pkce = await createPkce()
  brokerUrl.searchParams.set("callback", redirectUri)
  brokerUrl.searchParams.set("state", state)
  brokerUrl.searchParams.set("code_challenge", pkce.challenge)
  brokerUrl.searchParams.set("code_challenge_method", "S256")

  const response = NextResponse.redirect(brokerUrl)
  const names = identityLoginCookieNames(redirectUri, state)
  const isSecure = callbackUrl.protocol === "https:"
  response.cookies.set(names.state, state, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  })
  response.cookies.set(names.verifier, pkce.verifier, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  })
  response.headers.set("Cache-Control", "no-store")
  response.headers.set("Referrer-Policy", "no-referrer")

  return response
}
