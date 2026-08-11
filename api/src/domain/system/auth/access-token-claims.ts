import { z } from "zod"
import { zAccountId } from "@system/domain/auth/account-id"

export const ACCESS_TOKEN_TYPE = "at+jwt"

export const zAccessTokenClaims = z
  .object({
    sub: zAccountId,
    ver: z.number().int().nonnegative(),
    purpose: z.enum(["web-session", "mobile-session", "api-session"]),
    iss: z.string().min(1),
    aud: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
    jti: z.string().min(1),
    iat: z.number().int().nonnegative(),
    issuedAtMs: z.number().int().nonnegative(),
    exp: z.number().int().positive(),
  })
  .strict()

export type AccessTokenClaims = z.infer<typeof zAccessTokenClaims>
