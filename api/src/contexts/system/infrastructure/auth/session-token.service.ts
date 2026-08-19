import { createAccessTokenService } from "@system/infrastructure/auth/access-token.service"
import { z } from "zod"
import { JwtTokenService } from "@/contexts/system/infrastructure/auth/jwt-token.service"

const legacySessionPayloadSchema = z.object({
  purpose: z.literal("web-session").nullable().default(null),
  userId: z.string(),
  exp: z.number(),
  iat: z.number().nullable().default(null),
  issuedAtMs: z.number().int().nullable().default(null),
})

const accessTokenService = createAccessTokenService({
  issuer: "system",
  audience: "system-web",
  purpose: "web-session",
  maxAgeSeconds: 60 * 60 * 24 * 7,
})

export type SessionPayload = Readonly<{
  accountId: string
  tokenVersion: number
  purpose: "web-session"
  exp: number
  iat: number | null
  issuedAtMs: number | null
}>

export class SessionTokenService {
  static readonly MAX_AGE_SECONDS = 60 * 60 * 24 * 7
  static readonly REFRESH_AFTER_SECONDS = 60 * 60 * 24
  static readonly ISSUER = "system"
  static readonly AUDIENCE = "system-web"

  static async create(accountId: string, secret: string, tokenVersion: number): Promise<string> {
    return accessTokenService.create({ accountId, tokenVersion }, secret)
  }

  static async verify(token: string, secret: string): Promise<SessionPayload> {
    try {
      const payload = await accessTokenService.verify(token, secret)
      return {
        accountId: payload.sub,
        tokenVersion: payload.ver,
        purpose: "web-session",
        exp: payload.exp,
        iat: payload.iat,
        issuedAtMs: payload.issuedAtMs,
      }
    } catch {
      return SessionTokenService.verifyLegacy(token, secret)
    }
  }

  private static async verifyLegacy(token: string, secret: string): Promise<SessionPayload> {
    const verified = await JwtTokenService.verifyWithHeader(token, secret)

    if (verified.protectedHeader.typ !== "JWT" && verified.protectedHeader.typ !== undefined) {
      throw new Error("invalid web session token type")
    }

    const legacy = legacySessionPayloadSchema.parse(verified.payload)

    return {
      accountId: legacy.userId,
      tokenVersion: 0,
      purpose: "web-session",
      exp: legacy.exp,
      iat: legacy.iat,
      issuedAtMs: legacy.issuedAtMs,
    }
  }
}
