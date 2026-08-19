import { createAccessTokenService } from "@system/infrastructure/auth/access-token.service"
import { JwtTokenService } from "@/contexts/system/infrastructure/auth/jwt-token.service"
import { z } from "zod"

const legacyMobileSessionPayloadSchema = z.object({
  purpose: z.literal("mobile-session"),
  iss: z.literal("system"),
  aud: z.literal("system-mobile"),
  userId: z.string(),
  exp: z.number(),
  iat: z.number(),
  issuedAtMs: z.number().int(),
})

const accessTokenService = createAccessTokenService({
  issuer: "system",
  audience: "system-mobile",
  purpose: "mobile-session",
  maxAgeSeconds: 60 * 60 * 24,
})

export type MobileSessionPayload = Readonly<{
  accountId: string
  tokenVersion: number
  purpose: "mobile-session"
  exp: number
  iat: number
  issuedAtMs: number
}>

export class MobileSessionTokenService {
  static readonly MAX_AGE_SECONDS = 60 * 60 * 24
  static readonly ISSUER = "system"
  static readonly AUDIENCE = "system-mobile"

  static async create(accountId: string, secret: string, tokenVersion: number): Promise<string> {
    return accessTokenService.create({ accountId, tokenVersion }, secret)
  }

  static async verify(token: string, secret: string): Promise<MobileSessionPayload> {
    try {
      const claims = await accessTokenService.verify(token, secret)
      return {
        accountId: claims.sub,
        tokenVersion: claims.ver,
        purpose: "mobile-session",
        exp: claims.exp,
        iat: claims.iat,
        issuedAtMs: claims.issuedAtMs,
      }
    } catch {
      return MobileSessionTokenService.verifyLegacy(token, secret)
    }
  }

  private static async verifyLegacy(token: string, secret: string): Promise<MobileSessionPayload> {
    const verified = await JwtTokenService.verifyWithHeader(token, secret)

    if (verified.protectedHeader.typ !== "JWT" && verified.protectedHeader.typ !== undefined) {
      throw new Error("Invalid mobile session token type")
    }

    const legacy = legacyMobileSessionPayloadSchema.parse(verified.payload)
    return {
      accountId: legacy.userId,
      tokenVersion: 0,
      purpose: legacy.purpose,
      exp: legacy.exp,
      iat: legacy.iat,
      issuedAtMs: legacy.issuedAtMs,
    }
  }
}
