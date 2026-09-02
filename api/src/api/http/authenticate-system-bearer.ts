import type { HonoEnv } from "@/env"
import { resolveBearerAccount } from "@/api/http/resolve-bearer-account"
import { UnauthorizedError } from "@/lib/http/errors"
import { SystemD1AuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-authorization.adapter"
import { readBearerAuthorization } from "@system/interface/authorization/lib/bearer-authorization"
import type { Context } from "hono"

/** 外部access tokenまたは従来System sessionを検証し、System主体を注入する。 */
export async function authenticateSystemBearer(c: Context<HonoEnv>): Promise<void> {
  const now = new Date(c.env.NOW ?? Date.now())
  if (!Number.isSafeInteger(now.getTime())) {
    throw new UnauthorizedError("account authorization is unavailable")
  }

  const authorization = readBearerAuthorization(c.req.header("authorization"))
  if (authorization.kind !== "token") throw new UnauthorizedError("invalid token")

  const bearerAccount = await resolveBearerAccount({
    token: authorization.token,
    env: c.env,
    now,
  })
  if (bearerAccount.kind === "unavailable") {
    throw new UnauthorizedError("account authentication is unavailable")
  }
  if (bearerAccount.kind === "rejected") throw new UnauthorizedError(bearerAccount.reason)

  const accountAuthorization = await new SystemD1AuthorizationAdapter({
    env: { DB: c.env.DB },
  }).resolveForAccount({ accountId: bearerAccount.accountId, resource: null, at: now })
  if (accountAuthorization instanceof Error) {
    throw new UnauthorizedError("account authorization is unavailable")
  }
  if (accountAuthorization === null) throw new UnauthorizedError("invalid token")

  c.set("userId", bearerAccount.accountId)
  c.set("accountTokenVersion", bearerAccount.tokenVersion)
  c.set("permissions", accountAuthorization.permissionKeys)
  c.set("scopedPermissions", accountAuthorization.scopedPermissionKeys)
  c.set("role", accountAuthorization.roleKeys[0] ?? "authenticated")
  c.set("roleKeys", accountAuthorization.roleKeys)
}
