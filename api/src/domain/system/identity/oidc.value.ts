import { parseBearerAuthorization } from "@system/domain/auth/parse-bearer-authorization"

const canonicalAccessTokenPattern = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u

export type OidcIssuerConfiguration = Readonly<{
  issuersByHostname: Readonly<Record<string, string>>
  localProxyHostnames: ReadonlyArray<string>
  localIssuerHostname: string | null
}>

export class OidcValue {
  static readonly ALGORITHM = "ES256" as const
  static readonly AUTHORIZATION_CODE_MAX_AGE_MS = 2 * 60 * 1000
  static readonly TOKEN_MAX_AGE_SECONDS = 5 * 60
  static readonly TOKEN_MAX_AGE_MS = OidcValue.TOKEN_MAX_AGE_SECONDS * 1000
  static readonly SUPPORTED_SCOPES = Object.freeze(["openid", "profile", "email"] as const)

  static accessTokenFromAuthorizationHeader(authorizationHeader: string | null): string | null {
    if (authorizationHeader !== null && typeof authorizationHeader !== "string") return null

    const authorization = parseBearerAuthorization(authorizationHeader ?? undefined)

    return authorization.kind === "token" && canonicalAccessTokenPattern.test(authorization.token)
      ? authorization.token
      : null
  }

  static issuer(
    props: Readonly<{ requestUrl: string; forwardedHost: string | null }>,
    configuration: OidcIssuerConfiguration,
  ): string | Error {
    const parsed = OidcValue.parseIssuerInput(props, configuration)
    if (parsed instanceof Error) return parsed

    const {
      requestUrl,
      forwardedHost,
      issuersByHostname,
      localProxyHostnames,
      localIssuerHostname,
    } = parsed
    const requestHostname = requestUrl.hostname.toLowerCase()

    if (requestUrl.protocol === "https:" && requestUrl.port === "") {
      const directIssuer = OidcValue.configuredIssuer(requestHostname, issuersByHostname)
      if (directIssuer !== null) return directIssuer
    }

    if (
      requestUrl.protocol !== "http:" ||
      !localProxyHostnames.includes(requestHostname) ||
      localIssuerHostname === null ||
      forwardedHost === null ||
      forwardedHost.includes(",")
    ) {
      return new Error("unknown_oidc_issuer")
    }

    const forwardedUrl = OidcValue.parseForwardedAuthority(forwardedHost)
    if (forwardedUrl === null || forwardedUrl.hostname.toLowerCase() !== localIssuerHostname) {
      return new Error("unknown_oidc_issuer")
    }

    return (
      OidcValue.configuredIssuer(localIssuerHostname, issuersByHostname) ??
      new Error("unknown_oidc_issuer")
    )
  }

  private static parseIssuerInput(
    props: Readonly<{ requestUrl: string; forwardedHost: string | null }>,
    configuration: OidcIssuerConfiguration,
  ):
    | Readonly<{
        requestUrl: URL
        forwardedHost: string | null
        issuersByHostname: Readonly<Record<string, string>>
        localProxyHostnames: ReadonlyArray<string>
        localIssuerHostname: string | null
      }>
    | Error {
    if (!OidcValue.isPlainRecord(props) || !OidcValue.isPlainRecord(configuration)) {
      return new Error("unknown_oidc_issuer")
    }
    if (
      typeof props.requestUrl !== "string" ||
      (props.forwardedHost !== null && typeof props.forwardedHost !== "string") ||
      !OidcValue.isPlainRecord(configuration.issuersByHostname) ||
      !Array.isArray(configuration.localProxyHostnames) ||
      configuration.localProxyHostnames.length > 20 ||
      !configuration.localProxyHostnames.every(
        (hostname) =>
          typeof hostname === "string" &&
          hostname.length > 0 &&
          hostname.length <= 253 &&
          hostname === hostname.toLowerCase(),
      ) ||
      (configuration.localIssuerHostname !== null &&
        (typeof configuration.localIssuerHostname !== "string" ||
          configuration.localIssuerHostname.length === 0 ||
          configuration.localIssuerHostname.length > 253 ||
          configuration.localIssuerHostname !== configuration.localIssuerHostname.toLowerCase()))
    ) {
      return new Error("unknown_oidc_issuer")
    }

    let requestUrl: URL
    try {
      requestUrl = new URL(props.requestUrl)
    } catch {
      return new Error("unknown_oidc_issuer")
    }
    if (requestUrl.username !== "" || requestUrl.password !== "") {
      return new Error("unknown_oidc_issuer")
    }

    return {
      requestUrl,
      forwardedHost: props.forwardedHost,
      issuersByHostname: configuration.issuersByHostname,
      localProxyHostnames: configuration.localProxyHostnames,
      localIssuerHostname: configuration.localIssuerHostname,
    }
  }

  private static parseForwardedAuthority(value: string): URL | null {
    if (value.trim() !== value || value.length === 0 || value.length > 253) return null

    let parsed: URL
    try {
      parsed = new URL(`https://${value}`)
    } catch {
      return null
    }

    return parsed.username === "" &&
      parsed.password === "" &&
      parsed.port === "" &&
      parsed.pathname === "/" &&
      parsed.search === "" &&
      parsed.hash === ""
      ? parsed
      : null
  }

  private static configuredIssuer(
    hostname: string,
    issuersByHostname: Readonly<Record<string, string>>,
  ): string | null {
    const descriptor = Object.getOwnPropertyDescriptor(issuersByHostname, hostname)
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string"
    ) {
      return null
    }

    const issuer = descriptor.value
    if (issuer.length === 0 || issuer.length > 2_048) return null

    let parsedIssuer: URL
    try {
      parsedIssuer = new URL(issuer)
    } catch {
      return null
    }

    return parsedIssuer.protocol === "https:" &&
      parsedIssuer.hostname.toLowerCase() === hostname &&
      parsedIssuer.port === "" &&
      parsedIssuer.username === "" &&
      parsedIssuer.password === "" &&
      parsedIssuer.search === "" &&
      parsedIssuer.hash === ""
      ? issuer
      : null
  }

  private static isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false

    const prototype = Object.getPrototypeOf(value)

    return prototype === Object.prototype || prototype === null
  }
}
