import { oidcSigningAlgorithm } from "@system/domain/values/oidc-signing-algorithm.value"
import { oidcAccessTokenLifetime } from "@system/domain/values/oidc-token-lifetime.value"
import { createOidcSecret } from "@system/infrastructure/identity/create-oidc-secret.repository"
import type { OidcSigningKeys } from "@/contexts/system/infrastructure/identity/oidc-signing-key.service.repository"
import type { SystemClockContext } from "@system/infrastructure/configuration/system-context.repository"
import { importJWK, SignJWT } from "jose"

export type OidcIdentity = Readonly<{
  subject: string
  email: string | null
  emailVerified: boolean
}>

type Props = Readonly<{
  keys: OidcSigningKeys
  issuer: string
  clientId: string
  identity: OidcIdentity
  nonce: string
  scope: ReadonlyArray<string>
}>

export class OidcIdTokenService {
  constructor(private readonly c: SystemClockContext) {}

  async create(props: Props): Promise<string | Error> {
    try {
      const signingKey = await importJWK(props.keys.active, oidcSigningAlgorithm.toString())
      const nowSeconds = Math.floor(this.c.var.now().getTime() / 1000)
      const payload: Record<string, unknown> = { nonce: props.nonce }

      if (props.scope.includes("email") && props.identity.email !== null) {
        payload.email = props.identity.email
        payload.email_verified = props.identity.emailVerified
      }

      return await new SignJWT(payload)
        .setProtectedHeader({
          alg: oidcSigningAlgorithm.toString(),
          kid: props.keys.active.kid,
          typ: "JWT",
        })
        .setIssuer(props.issuer)
        .setSubject(props.identity.subject)
        .setAudience(props.clientId)
        .setIssuedAt(nowSeconds)
        .setExpirationTime(nowSeconds + oidcAccessTokenLifetime.seconds)
        .setJti(createOidcSecret())
        .sign(signingKey)
    } catch {
      return new Error("id_token_signing_failed")
    }
  }
}
