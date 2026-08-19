import { JwtTokenService } from "@/contexts/system/infrastructure/auth/jwt-token.service"
import { z } from "zod"

const GRANT_TOKEN_TYPE = "mcp-grant+jwt"

const grantPayloadSchema = z
  .object({
    accountId: z.string().min(1),
    tokenVersion: z.number().int().nonnegative(),
    challenge: z.string().min(1),
    purpose: z.literal("mcp-grant"),
    iss: z.literal("system"),
    aud: z.literal("system-mcp"),
    jti: z.string().min(1),
    exp: z.number(),
    iat: z.number(),
  })
  .strict()

const legacyGrantPayloadSchema = z.object({
  userId: z.string().min(1),
  challenge: z.string().min(1),
  purpose: z.literal("mcp-grant"),
  exp: z.number(),
  iat: z.number(),
})

export type McpGrantPayload = z.infer<typeof grantPayloadSchema>

export class McpGrantTokenService {
  static readonly MAX_AGE_SECONDS = 120
  static readonly ISSUER = "system"
  static readonly AUDIENCE = "system-mcp"

  static async create(
    accountId: string,
    tokenVersion: number,
    challenge: string,
    secret: string,
  ): Promise<string> {
    const nowSeconds = Math.floor(Date.now() / 1000)
    const payload = {
      accountId,
      tokenVersion,
      challenge,
      purpose: "mcp-grant",
      iss: McpGrantTokenService.ISSUER,
      aud: McpGrantTokenService.AUDIENCE,
      jti: crypto.randomUUID(),
      exp: nowSeconds + McpGrantTokenService.MAX_AGE_SECONDS,
      iat: nowSeconds,
    } satisfies McpGrantPayload

    return JwtTokenService.sign(payload, secret, GRANT_TOKEN_TYPE)
  }

  static async verify(token: string, secret: string): Promise<McpGrantPayload | Error> {
    try {
      const verified = await JwtTokenService.verifyWithHeader(token, secret)

      if (verified.protectedHeader.typ === GRANT_TOKEN_TYPE) {
        return grantPayloadSchema.parse(verified.payload)
      }

      if (verified.protectedHeader.typ !== "JWT" && verified.protectedHeader.typ !== undefined) {
        return new Error("invalid_grant")
      }

      const legacy = legacyGrantPayloadSchema.parse(verified.payload)
      return {
        accountId: legacy.userId,
        tokenVersion: 0,
        challenge: legacy.challenge,
        purpose: legacy.purpose,
        iss: McpGrantTokenService.ISSUER,
        aud: McpGrantTokenService.AUDIENCE,
        jti: "legacy",
        exp: legacy.exp,
        iat: legacy.iat,
      }
    } catch {
      return new Error("invalid_grant")
    }
  }
}
