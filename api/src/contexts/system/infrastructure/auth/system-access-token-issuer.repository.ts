import type { SystemAccessTokenIssuer as SystemAccessTokenIssuerPort } from "@system/infrastructure/auth/system-access-token-issuer-port.repository"
import type { AccountId } from "@system/domain/auth/account-id"
import { validateSystemAccessTokenSecret } from "@system/domain/auth/validate-system-access-token-secret"
import { AccessTokenService } from "@system/infrastructure/auth/access-token-service.repository"
import { SYSTEM_ACCESS_TOKEN_PROFILE } from "@system/infrastructure/auth/system-access-token-profile.repository"

type Props = Readonly<{
  accountId: AccountId
  tokenVersion: number
  now: Date
}>

/** 製品名を含まない固定profileでSystem access tokenを署名する。 */
export class SystemAccessTokenIssuer implements SystemAccessTokenIssuerPort {
  constructor(private readonly secret: string) {
    Object.freeze(this)
  }

  async issue(input: Props): Promise<string | Error> {
    const invalidSecret = validateSystemAccessTokenSecret(this.secret)
    if (invalidSecret !== null) return invalidSecret

    return new AccessTokenService({ profile: SYSTEM_ACCESS_TOKEN_PROFILE }).create(
      { accountId: String(input.accountId), tokenVersion: input.tokenVersion },
      this.secret,
      input.now,
    )
  }
}
