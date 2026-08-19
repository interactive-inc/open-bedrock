import { ResolveSystemAuthorization } from "@system/application/iam/resolve-system-authorization"
import { createSystemSessionApplications } from "@system/infrastructure/auth/create-system-session-applications"
import { SystemD1AuthorizationRepository } from "@system/infrastructure/iam/system-authorization-repository"
import { systemFactory } from "@system/interface/http/system-factory"

/** opaque System Sessionと現在のAccount / IAM状態を検証してSystem主体だけを注入する。 */
export const authenticateSystemSession = systemFactory.createMiddleware(async (context, next) => {
  const authorization = context.req.header("authorization")
  const rawToken = authorization?.match(/^Bearer[ \t]+([0-9a-f]{64})$/iu)?.[1]
  if (rawToken === undefined) {
    return context.json({ error: "invalid session", code: "invalid_session" }, 401)
  }

  const now = context.var.now()
  if (!Number.isSafeInteger(now.getTime())) {
    return context.json({ error: "session service unavailable", code: "session_unavailable" }, 503)
  }

  const applications = createSystemSessionApplications({
    context: { env: { DB: context.env.DB } },
    sessionTtlMilliseconds: 7 * 24 * 60 * 60 * 1_000,
  })
  if (applications instanceof Error) {
    return context.json({ error: "session service unavailable", code: "session_unavailable" }, 503)
  }

  const authentication = await applications.authenticate.execute({ rawToken, now })
  if (authentication instanceof Error) {
    return context.json({ error: "session service unavailable", code: "session_unavailable" }, 503)
  }
  if (authentication.kind === "rejected") {
    return context.json({ error: "invalid session", code: "invalid_session" }, 401)
  }

  const authorizationState = await new ResolveSystemAuthorization(
    new SystemD1AuthorizationRepository({ env: { DB: context.env.DB } }),
  ).execute({ accountId: authentication.accountId, resource: null, at: now })
  if (authorizationState instanceof Error) {
    return context.json(
      { error: "authorization service unavailable", code: "authorization_unavailable" },
      503,
    )
  }
  if (authorizationState === null) {
    return context.json({ error: "invalid session", code: "invalid_session" }, 401)
  }

  context.set("userId", authentication.accountId)
  context.set("accountTokenVersion", authentication.tokenVersion)
  context.set("permissions", authorizationState.permissionKeys)
  context.set("role", authorizationState.roleKeys[0] ?? "authenticated")
  await next()
})
