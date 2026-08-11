import { OidcValue } from "@system/domain/identity/oidc.value"

const supportedScopes = new Set<string>(OidcValue.SUPPORTED_SCOPES)
const maximumScopeLength = 500
const maximumScopeCount = 50

export class OidcScopeValue {
  static parse(value: unknown): ReadonlyArray<string> | Error {
    if (typeof value !== "string" || value.length > maximumScopeLength) {
      return new Error("invalid_scope")
    }

    const scopes = [
      ...new Set(
        value
          .trim()
          .split(/\s+/u)
          .filter((scope) => scope !== ""),
      ),
    ]

    if (scopes.length > maximumScopeCount) return new Error("invalid_scope")
    if (!scopes.includes("openid")) return new Error("openid_scope_required")
    if (scopes.some((scope) => !supportedScopes.has(scope))) {
      return new Error("unsupported_scope")
    }

    return Object.freeze(OidcValue.SUPPORTED_SCOPES.filter((scope) => scopes.includes(scope)))
  }
}
