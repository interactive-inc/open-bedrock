import {
  OidcValue,
  type OidcIssuerConfiguration,
} from "@/contexts/system/domain/identity/oidc.value"
import { OidcSigningKeyService } from "@/contexts/system/infrastructure/identity/oidc-signing-key.service.repository"

const DISCOVERY_PATH = "/.well-known/openid-configuration"
const JWKS_PATH = "/.well-known/jwks.json"

const PUBLIC_METADATA_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=300",
  "Content-Type": "application/json; charset=UTF-8",
} as const

type Props = Readonly<{
  request: Request
  signingKeysRaw: string | undefined
  issuerConfiguration: OidcIssuerConfiguration
}>

export class OidcMetadataHandler {
  static handle(props: Props): Response | null {
    const pathname = new URL(props.request.url).pathname
    if (pathname !== DISCOVERY_PATH && pathname !== JWKS_PATH) {
      return null
    }

    if (props.request.method !== "GET" && props.request.method !== "HEAD") {
      return Response.json(
        { error: "method_not_allowed" },
        { status: 405, headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" } },
      )
    }

    const issuer = OidcValue.issuer(
      {
        requestUrl: props.request.url,
        forwardedHost: props.request.headers.get("X-Forwarded-Host"),
      },
      props.issuerConfiguration,
    )
    if (issuer instanceof Error) {
      return Response.json({ error: "not_found" }, { status: 404 })
    }

    const signingKeys = OidcSigningKeyService.parse(props.signingKeysRaw)
    if (signingKeys instanceof Error) {
      console.error("OIDC signing keys are not configured")
      return Response.json(
        { error: "temporarily_unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      )
    }

    if (pathname === JWKS_PATH) {
      return OidcMetadataHandler.metadataResponse(props.request, {
        keys: OidcSigningKeyService.publicKeys(signingKeys),
      })
    }

    return OidcMetadataHandler.metadataResponse(props.request, {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/api/oauth/token`,
      userinfo_endpoint: `${issuer}/api/oauth/userinfo`,
      jwks_uri: `${issuer}${JWKS_PATH}`,
      scopes_supported: OidcValue.SUPPORTED_SCOPES,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: [OidcValue.ALGORITHM],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      authorization_response_iss_parameter_supported: true,
      claims_supported: [
        "sub",
        "iss",
        "aud",
        "exp",
        "iat",
        "nonce",
        "name",
        "email",
        "email_verified",
      ],
    })
  }

  private static metadataResponse(request: Request, value: unknown): Response {
    const body = request.method === "HEAD" ? null : JSON.stringify(value)
    return new Response(body, { headers: PUBLIC_METADATA_HEADERS })
  }
}
