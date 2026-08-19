import type {
  IssueSystemAccessTokenInput,
  SystemAccessTokenIssuer as SystemAccessTokenIssuerPort,
} from "@system/application/auth/system-access-token-issuer"
import { validateSystemAccessTokenSecret } from "@system/domain/auth/validate-system-access-token-secret"
import { AccessTokenService } from "@system/infrastructure/auth/access-token-service"
import { SYSTEM_ACCESS_TOKEN_PROFILE } from "@system/infrastructure/auth/system-access-token-profile"

/** 製品名を含まない固定profileでSystem access tokenを署名する。 */
export class SystemAccessTokenIssuer implements SystemAccessTokenIssuerPort {
  constructor(private readonly secret: string) {
    Object.freeze(this)
  }

  async issue(input: IssueSystemAccessTokenInput): Promise<string | Error> {
    const invalidSecret = validateSystemAccessTokenSecret(this.secret)
    if (invalidSecret !== null) return invalidSecret

    return new AccessTokenService({ profile: SYSTEM_ACCESS_TOKEN_PROFILE }).create(
      { accountId: String(input.accountId), tokenVersion: input.tokenVersion },
      this.secret,
      input.now,
    )
  }
}
