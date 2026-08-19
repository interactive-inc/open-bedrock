import { systemFactory } from "@system/interface/http/system-factory"
import { authenticateSystemAccessTokenRequest } from "@system/interface/runtime/authenticate-system-access-token-request"

/** access tokenと現在のAccount / IAM状態を検証してSystem主体だけを注入する。 */
export const authenticateSystemAccessToken = systemFactory.createMiddleware(
  async (context, next) => {
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }

    const authentication = await authenticateSystemAccessTokenRequest({
      database: context.env.DB,
      authorizationHeader: context.req.header("authorization"),
      jwtSecret: context.env.JWT_SECRET ?? "",
      now,
    })
    if (authentication.kind === "unavailable") {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }
    if (authentication.kind === "rejected") {
      return context.json({ error: "invalid session", code: "invalid_session" }, 401)
    }

    context.set("userId", authentication.accountId)
    context.set("accountTokenVersion", authentication.tokenVersion)
    context.set("permissions", authentication.permissionKeys)
    context.set("role", authentication.roleKeys[0] ?? "authenticated")
    context.set("roleKeys", authentication.roleKeys)
    await next()
  },
)
