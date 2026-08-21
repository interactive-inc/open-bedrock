import type { AccountId } from "@system/domain/values/account-id.schema"
import { SystemAccessTokenSecretValue } from "@system/domain/values/system-access-token-secret.value"
import { AccessTokenService } from "@system/infrastructure/auth/access-token-service.repository"
import { SYSTEM_ACCESS_TOKEN_PROFILE } from "@system/infrastructure/auth/system-access-token-profile.repository"

type Props = Readonly<{
  accountId: AccountId
  tokenVersion: number
  now: Date
}>

/** 製品名を含まない固定profileでSystem access tokenを署名する。 */
export class SystemAccessTokenIssuer {
  constructor(private readonly secret: string) {
    Object.freeze(this)
  }

  async issue(input: Props): Promise<string | Error> {
    const accessTokenSecret = SystemAccessTokenSecretValue.create(this.secret)
    if (!(accessTokenSecret instanceof SystemAccessTokenSecretValue)) return accessTokenSecret

    return new AccessTokenService({ profile: SYSTEM_ACCESS_TOKEN_PROFILE }).create(
      { accountId: String(input.accountId), tokenVersion: input.tokenVersion },
      accessTokenSecret.toString(),
      input.now,
    )
  }
}
