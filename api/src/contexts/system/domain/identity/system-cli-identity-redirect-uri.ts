import { isSecureSystemIdentityIssuer } from "@system/domain/identity/is-secure-system-identity-issuer"

/**
 * API originを検証し、ブローカーへ登録するCLI callback URLを返す。
 */
export function systemCliIdentityRedirectUri(apiOrigin: string): string | Error {
  try {
    const origin = new URL(apiOrigin)
    if (
      !isSecureSystemIdentityIssuer(origin) ||
      origin.username !== "" ||
      origin.password !== "" ||
      origin.pathname !== "/" ||
      origin.search !== "" ||
      origin.hash !== ""
    ) {
      return new Error("API origin is invalid")
    }

    return new URL("/system/v1/cli-authorization-callback", origin.origin).toString()
  } catch {
    return new Error("API origin is invalid")
  }
}
