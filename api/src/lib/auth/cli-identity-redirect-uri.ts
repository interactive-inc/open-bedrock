import { isSecureIdentityIssuer } from "@/lib/auth/is-secure-identity-issuer"

/**
 * API originを検証し、ブローカーへ登録するCLI callback URLを返す。
 */
export function cliIdentityRedirectUri(apiOrigin: string): string | Error {
  try {
    const origin = new URL(apiOrigin)
    if (
      !isSecureIdentityIssuer(origin) ||
      origin.username !== "" ||
      origin.password !== "" ||
      origin.pathname !== "/" ||
      origin.search !== "" ||
      origin.hash !== ""
    ) {
      return new Error("API origin is invalid")
    }

    return new URL("/auth/cli/callback", origin.origin).toString()
  } catch {
    return new Error("API origin is invalid")
  }
}
