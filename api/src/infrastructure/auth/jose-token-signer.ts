import {
  createAccessTokenService,
  type AccessTokenProfile,
} from "@/infrastructure/system/auth/access-token.service"
import type { TokenPayload } from "@/lib/auth/token-payload"

export const ACCESS_TOKEN_ISSUER = "open-bedrock"
export const ACCESS_TOKEN_AUDIENCE = "open-bedrock-api"
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60

export const ACCESS_TOKEN_PROFILE = Object.freeze({
  issuer: ACCESS_TOKEN_ISSUER,
  audience: ACCESS_TOKEN_AUDIENCE,
  purpose: "api-session",
  maxAgeSeconds: ACCESS_TOKEN_MAX_AGE_SECONDS,
}) satisfies AccessTokenProfile

export const accessTokenService = createAccessTokenService(ACCESS_TOKEN_PROFILE)

export class JoseTokenSigner {
  constructor() {
    Object.freeze(this)
  }

  async sign(payload: TokenPayload, jwtSecret: string): Promise<string | Error> {
    try {
      return await accessTokenService.create(
        { accountId: String(payload.accountId), tokenVersion: payload.tokenVersion },
        jwtSecret,
      )
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("token signing failed")
    }
  }
}
