import { OidcValue } from "@system/domain/identity/oidc.value"
import { z } from "zod"

const base64UrlCoordinate = z.string().regex(/^[A-Za-z0-9_-]{43}$/)
const keyId = z.string().regex(/^[A-Za-z0-9._-]{1,64}$/)

const publicKeySchema = z
  .object({
    kty: z.literal("EC"),
    crv: z.literal("P-256"),
    x: base64UrlCoordinate,
    y: base64UrlCoordinate,
    kid: keyId,
    use: z.literal("sig"),
    alg: z.literal(OidcValue.ALGORITHM),
  })
  .strict()

const signingKeysSchema = z
  .object({
    active: publicKeySchema.extend({ d: base64UrlCoordinate }).strict(),
    previous: z.array(publicKeySchema).max(2).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    const keyIds = [value.active.kid, ...value.previous.map((key) => key.kid)]

    if (new Set(keyIds).size !== keyIds.length) {
      context.addIssue({ code: "custom", message: "OIDC signing key IDs must be unique" })
    }
  })

export type OidcSigningKeys = z.infer<typeof signingKeysSchema>
export type OidcPublicKey = z.infer<typeof publicKeySchema>

export class OidcSigningKeyService {
  static parse(raw: string | undefined): OidcSigningKeys | Error {
    if (!raw) {
      return new Error("oidc_signing_keys_missing")
    }

    try {
      const result = signingKeysSchema.safeParse(JSON.parse(raw) as unknown)

      return result.success ? result.data : new Error("oidc_signing_keys_invalid")
    } catch {
      return new Error("oidc_signing_keys_invalid")
    }
  }

  static publicKeys(keys: OidcSigningKeys): ReadonlyArray<OidcPublicKey> {
    const active = {
      kty: keys.active.kty,
      crv: keys.active.crv,
      x: keys.active.x,
      y: keys.active.y,
      kid: keys.active.kid,
      use: keys.active.use,
      alg: keys.active.alg,
    } satisfies OidcPublicKey

    return [active, ...keys.previous]
  }
}
