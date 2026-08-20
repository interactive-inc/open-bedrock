import { SystemInvalidSessionError, SystemSessionUnavailableError } from "@system/interface/errors"
import { systemFactory } from "@system/interface/http/system-factory"
import { authenticateSystemAccessTokenRequest } from "@system/interface/runtime/authenticate-system-access-token-request"

/** access tokenと現在のAccount / IAM状態を検証してSystem主体だけを注入する。 */
export const authenticateSystemAccessToken = systemFactory.createMiddleware(
  async (context, next) => {
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemSessionUnavailableError()
    }

    const authentication = await authenticateSystemAccessTokenRequest({
      database: context.env.DB,
      authorizationHeader: context.req.header("authorization"),
      jwtSecret: context.env.JWT_SECRET ?? "",
      now,
    })
    if (authentication.kind === "unavailable") {
      throw new SystemSessionUnavailableError()
    }
    if (authentication.kind === "rejected") {
      throw new SystemInvalidSessionError()
    }

    context.set("userId", authentication.accountId)
    context.set("accountTokenVersion", authentication.tokenVersion)
    context.set("permissions", authentication.permissionKeys)
    context.set("role", authentication.roleKeys[0] ?? "authenticated")
    context.set("roleKeys", authentication.roleKeys)
    await next()
  },
)
