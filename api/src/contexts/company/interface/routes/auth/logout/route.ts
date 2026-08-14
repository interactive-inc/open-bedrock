import { createAuditEvent } from "@/contexts/company/application/audit/company-audit-event"
import { AuditEventRepository } from "@/contexts/company/infrastructure/company/audit/audit-event-repository"
import { RefreshTokenRepository } from "@/contexts/company/infrastructure/auth/refresh-token-repository"
import { assertAuditHmacSecret } from "@/lib/audit/assert-audit-hmac-secret"
import { hashAuditIdentifier } from "@/lib/audit/hash-audit-identifier"
import { refreshTokenHash } from "@/lib/auth/refresh-token-hash"
import { factory } from "@/contexts/company/interface/utils/factory"
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
    const nowEpoch = Math.floor(now.getTime() / 1_000)

    let auditHmacSecret: string
    try {
      assertAuditHmacSecret(c.env.AUDIT_HMAC_SECRET)
      auditHmacSecret = c.env.AUDIT_HMAC_SECRET
    } catch {
      // HMAC secret missing — still revoke, but skip audit
      return c.body(null, 204)
    }

    const refreshTokenRepository = new RefreshTokenRepository(c)
    const auditRepository = new AuditEventRepository(c)

    const hashedToken = await refreshTokenHash(json.refresh_token)
    const existing = await refreshTokenRepository.findByHash(hashedToken)

    if (existing instanceof Error || existing === null) {
      // Token not found or DB error — return 204 regardless (logout is idempotent)
      return c.body(null, 204)
    }

    const familyHash = await hashAuditIdentifier(
      `refresh-family:${existing.familyId}`,
      auditHmacSecret,
    )

    const record = createAuditEvent(
      {
        actorAccountId: existing.accountId,
        actorEmployeeId: null,
        action: "auth.session.logout",
        target: { type: "account", id: String(existing.accountId) },
        outcome: "succeeded",
        reasonCode: null,
        metadata: { family_id_hash: familyHash },
        now,
      },
      c.var.auditContext,
    )

    const auditStatements = auditRepository.prepareAppend(record)

    const revokeResult = await refreshTokenRepository.revokeFamilyWithAudit({
      familyId: existing.familyId,
      nowEpoch,
      auditStatements,
    })

    if (revokeResult instanceof Error) {
      // Revocation failed — return 204 anyway (client should still clear cookies)
      console.error("[auth/logout] failed to revoke token family", revokeResult)
    }

    return c.body(null, 204)
  },
)
