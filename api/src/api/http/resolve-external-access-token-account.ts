import type { Bindings } from "@/env"
import { externalAccessTokenVerificationKey } from "@/api/http/external-access-token-verification-key"
import { identitySubjectSchema } from "@system/domain/schemas/identity/identity-subject.schema"
import { SystemIdentityLoginAdapter } from "@system/infrastructure/adapters/auth/system-identity-login.adapter"
import { decodeProtectedHeader, jwtVerify } from "jose"
import { z } from "zod"

const claimsSchema = z.object({
  sub: identitySubjectSchema,
  email: z.string().email().max(254),
  email_verified: z.literal(true),
  name: z.string().min(1).max(200),
  client_id: z.string().min(1).max(200),
  scope: z.string().min(1).max(2_000),
  iat: z.number().int(),
  exp: z.number().int(),
  jti: z.string().min(1).max(512),
})

export type ExternalAccessTokenAccountResolution =
  | Readonly<{ kind: "not_external" }>
  | Readonly<{ kind: "accepted"; accountId: string; tokenVersion: number }>
  | Readonly<{ kind: "rejected" }>
  | Readonly<{ kind: "unavailable" }>

function hasExternalAccessTokenConfiguration(env: Bindings): boolean {
  return (
    env.IDENTITY_ISSUER !== undefined &&
    env.IDENTITY_ISSUER.length > 0 &&
    env.IDENTITY_ACCESS_TOKEN_AUDIENCE !== undefined &&
    env.IDENTITY_ACCESS_TOKEN_AUDIENCE.length > 0
  )
}

/** 外部IdPのAPI向けaccess tokenを既存のSystem Accountへ解決する。 */
export async function resolveExternalAccessTokenAccount(props: {
  token: string
  env: Bindings
  now: Date
}): Promise<ExternalAccessTokenAccountResolution> {
  try {
    const header = decodeProtectedHeader(props.token)
    if (header.alg !== "EdDSA" || header.typ !== "at+jwt") return { kind: "not_external" }
  } catch {
    return { kind: "not_external" }
  }

  if (!hasExternalAccessTokenConfiguration(props.env)) return { kind: "rejected" }

  const issuer = props.env.IDENTITY_ISSUER
  const audience = props.env.IDENTITY_ACCESS_TOKEN_AUDIENCE
  if (issuer === undefined || audience === undefined) return { kind: "unavailable" }

  const verificationKey = await externalAccessTokenVerificationKey({
    issuer,
    jwks: props.env.IDENTITY_JWKS,
  })
  if (verificationKey instanceof Error) return { kind: "unavailable" }

  try {
    const verified = await jwtVerify(props.token, verificationKey, {
      algorithms: ["EdDSA"],
      issuer,
      audience,
      typ: "at+jwt",
      requiredClaims: ["sub", "iat", "exp", "jti", "client_id", "scope"],
      currentDate: props.now,
      clockTolerance: 5,
    })
    const claims = claimsSchema.safeParse(verified.payload)
    if (!claims.success || claims.data.exp <= claims.data.iat) return { kind: "rejected" }

    const login = await new SystemIdentityLoginAdapter({ env: { DB: props.env.DB } }).find(
      "oidc",
      claims.data.sub,
    )
    if (login instanceof Error) return { kind: "unavailable" }
    if (login === null || login.account.status !== "active") return { kind: "rejected" }

    return {
      kind: "accepted",
      accountId: login.account.id,
      tokenVersion: login.account.tokenVersion,
    }
  } catch {
    return { kind: "rejected" }
  }
}
