import type { AccessTokenView } from "@/application/auth/access-token-view"
import type { Context } from "@/env"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { AccountAuthRepository } from "@/infrastructure/auth/account-auth-repository"
import { JoseTokenSigner } from "@/infrastructure/auth/jose-token-signer"
import { RefreshTokenRepository } from "@/infrastructure/auth/refresh-token-repository"
import { refreshTokenHash } from "@/lib/auth/refresh-token-hash"

export type Command = {
  refreshToken: string
  jwtSecret: string
  userAgent: string | null
}

export type InvalidToken = { reason: "invalid_token" }

/**
 * リフレッシュトークンを検証し、新しいアクセストークンとリフレッシュトークンを発行する。
 * 旧リフレッシュトークンは revoke し、同一 familyId で新トークンを発行する（ローテーション）。
 * トークン再利用を検知した場合は family 全体を revoke する。
 */
export class RefreshAccessToken {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<AccessTokenView | InvalidToken | ApplicationError> {
    const refreshTokenRepository = new RefreshTokenRepository(this.c)

    const nowEpoch = Math.floor(Date.now() / 1000)

    const hashedToken = await refreshTokenHash(command.refreshToken)

    const existing = await refreshTokenRepository.findValidByHash(hashedToken, nowEpoch)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find refresh token", { cause: existing })
    }

    if (existing === null) {
      return { reason: "invalid_token" }
    }

    const revokeResult = await refreshTokenRepository.revoke(existing.id, nowEpoch)

    if (revokeResult instanceof Error) {
      return new UnexpectedError("failed to revoke old refresh token", { cause: revokeResult })
    }

    const accountAuthRepository = new AccountAuthRepository(this.c)

    const account = await accountAuthRepository.findById(existing.accountId)

    if (account instanceof Error) {
      return new UnexpectedError("failed to find account", { cause: account })
    }

    if (account === null || account.status !== "active" || account.employeeId === null) {
      return { reason: "invalid_token" }
    }

    const tokenSigner = new JoseTokenSigner()

    const accessToken = await tokenSigner.sign(
      {
        accountId: existing.accountId,
        employeeId: account.employeeId,
        tokenVersion: account.tokenVersion,
      },
      command.jwtSecret,
    )

    if (accessToken instanceof Error) {
      return new UnexpectedError("failed to sign access token", { cause: accessToken })
    }

    const newRawRefreshToken = crypto.randomUUID()

    const newHashedToken = await refreshTokenHash(newRawRefreshToken)

    const createResult = await refreshTokenRepository.create({
      accountId: existing.accountId,
      tokenHash: newHashedToken,
      familyId: existing.familyId,
      userAgent: command.userAgent,
      nowEpoch,
    })

    if (createResult instanceof Error) {
      return new UnexpectedError("failed to create new refresh token", { cause: createResult })
    }

    return { accessToken, refreshToken: newRawRefreshToken }
  }
}
