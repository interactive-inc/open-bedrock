import { SystemInvalidSessionError, SystemSessionUnavailableError } from "@system/interface/errors"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAccessTokenSecretValue } from "@system/domain/values/auth/system-access-token-secret.value"
import { AccessTokenService } from "@system/infrastructure/auth/access-token-service.repository"
import { SYSTEM_ACCESS_TOKEN_PROFILE } from "@system/infrastructure/auth/system-access-token-profile.repository"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account.repository"
import { SystemD1AuthorizationRepository } from "@system/infrastructure/iam/system-authorization.repository"
import { readBearerAuthorization } from "@system/interface/lib/authorization/bearer-authorization"

/** access tokenと現在のAccount / IAM状態を検証してSystem主体だけを注入する。 */
export const authenticateSystemAccessToken = systemFactory.createMiddleware(
  async (context, next) => {
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemSessionUnavailableError()
    }

    const authorization = readBearerAuthorization(context.req.header("authorization"))
    if (authorization.kind !== "token") {
      throw new SystemInvalidSessionError()
    }

    const accessTokenSecret = SystemAccessTokenSecretValue.create(context.env.JWT_SECRET ?? "")
    if (!(accessTokenSecret instanceof SystemAccessTokenSecretValue)) {
      throw new SystemSessionUnavailableError()
    }

    const claims = await new AccessTokenService({
      profile: SYSTEM_ACCESS_TOKEN_PROFILE,
    }).verify(authorization.token, accessTokenSecret.toString(), new Date())
    if (claims instanceof Error) {
      throw new SystemInvalidSessionError()
    }

    const accountId = zAccountId.safeParse(claims.sub)
    if (!accountId.success) {
      throw new SystemInvalidSessionError()
    }

    const accountSession = await SystemAccountRepository.resolveSession({
      accountRepository: new SystemAccountRepository({ database: context.env.DB }),
      accountId: accountId.data,
      sessionTokenVersion: claims.ver,
    })
    if (accountSession instanceof Error) {
      throw new SystemSessionUnavailableError()
    }
    if (accountSession.kind === "rejected") {
      if (accountSession.reason === "invalid_account_token_version") {
        throw new SystemSessionUnavailableError()
      }
      throw new SystemInvalidSessionError()
    }

    const accountAuthorization = await new SystemD1AuthorizationRepository({
      env: { DB: context.env.DB },
    }).resolveForAccount({ accountId: accountId.data, resource: null, at: now })
    if (accountAuthorization instanceof Error) {
      throw new SystemSessionUnavailableError()
    }
    if (accountAuthorization === null) {
      throw new SystemInvalidSessionError()
    }

    context.set("userId", accountId.data)
    context.set("accountTokenVersion", accountSession.account.tokenVersion)
    context.set("permissions", accountAuthorization.permissionKeys)
    context.set("role", accountAuthorization.roleKeys[0] ?? "authenticated")
    context.set("roleKeys", accountAuthorization.roleKeys)
    await next()
  },
)
