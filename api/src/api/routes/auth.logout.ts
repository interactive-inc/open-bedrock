import { factory } from "@/contexts/company/interface/utils/factory"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { createSystemSessionApplications } from "@system/interface/runtime/create-system-session-applications"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization public - 未認証で到達してよい
/** POST /auth/logout — リフレッシュトークンのファミリーを失効させ、サーバー側でセッションを終了する */
export const POST = factory.createHandlers(
  zValidator(
    "json",
    z.object({
      refresh_token: z.string().max(200),
    }),
  ),
  async (c) => {
    const json = c.req.valid("json")
    const now = c.env.NOW === undefined ? new Date() : new Date(c.env.NOW)
    const applications = createSystemSessionApplications({
      context: { env: { DB: c.env.DB } },
      jwtSecret: c.env.JWT_SECRET,
      sessionTtlMilliseconds: 7 * 24 * 60 * 60 * 1_000,
    })
    if (applications instanceof Error) {
      console.error("[auth/logout] failed to configure canonical System Session")
      return c.body(null, 204)
    }

    const metadataJson = toStableSystemAuditJson({
      client_ip: c.var.auditContext.clientIp,
      client_name: c.var.auditContext.clientName,
      request_id: c.var.auditContext.requestId,
    })
    if (metadataJson instanceof Error) return c.body(null, 204)

    const revokeResult = await applications.revoke.execute({
      rawToken: json.refresh_token,
      now,
      auditContext: { authorizationJson: null, metadataJson },
    })

    if (revokeResult instanceof Error) {
      console.error("[auth/logout] failed to revoke canonical System Session")
    }

    return c.body(null, 204)
  },
)
