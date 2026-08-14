import type { AccessTokenView } from "@system/application/auth/access-token-view"
import { resolveAccountSession } from "@system/application/auth/resolve-account-session"
import { zAccountId } from "@system/domain/auth/account-id"
import { getAccountSessionRejection } from "@/contexts/system/domain/auth/get-account-session-rejection"
import type { RefreshTokenRotationDecision } from "@/contexts/system/domain/auth/refresh-token-rotation-decision"
import { createAuditEvent } from "@/composition/audit/audit-event"
import type { Context } from "@/env"
import { AuditEventRepository } from "@/contexts/company/infrastructure/company/audit/audit-event-repository"
import type { AuditDecisionAppendFragment } from "@/contexts/company/infrastructure/company/audit/audit-event-repository"
import { AccountEmployeeLinkRepository } from "@/contexts/company/infrastructure/employee/account-employee-link-repository"
import { JoseTokenSigner } from "@/contexts/company/infrastructure/auth/jose-token-signer"
import { RefreshTokenRepository } from "@/contexts/company/infrastructure/auth/refresh-token-repository"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account-repository"
import { resolveLiveEmployeeAccess } from "@/contexts/company/application/auth/resolve-live-employee-access"
import { assertAuditHmacSecret } from "@/lib/audit/assert-audit-hmac-secret"
import { hashAuditIdentifier } from "@/lib/audit/hash-audit-identifier"
import { refreshTokenHash } from "@/lib/auth/refresh-token-hash"
import { generateOpaqueToken } from "@/contexts/system/infrastructure/auth/generate-opaque-token"
import { ApplicationError, UnavailableError, UnexpectedError } from "@/lib/errors"

export type Command = {
  refreshToken: string
  jwtSecret: string
  userAgent: string | null
  now: Date
}

export type InvalidToken = { reason: "invalid_token" }

function auditUnavailable(cause: unknown): UnavailableError {
  return new UnavailableError("invalid or expired refresh token", "audit_unavailable", { cause })
}

/**
 * リフレッシュトークンを検証し、新しいアクセストークンとリフレッシュトークンを発行する。
 * token mutation と decision に対応する監査イベントは一つの D1 batch で確定する。
 */
export class RefreshAccessToken {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<AccessTokenView | InvalidToken | ApplicationError> {
    try {
      assertAuditHmacSecret(this.c.env.AUDIT_HMAC_SECRET)
    } catch (cause) {
      return auditUnavailable(cause)
    }

    const refreshTokenRepository = new RefreshTokenRepository(this.c)
    const auditRepository = new AuditEventRepository(this.c)
    const nowEpoch = Math.floor(command.now.getTime() / 1_000)
    const hashedToken = await refreshTokenHash(command.refreshToken)
    const existing = await refreshTokenRepository.findByHash(hashedToken)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find refresh token", { cause: existing })
    }

    if (existing === null) {
      try {
        await auditRepository.append(
          createAuditEvent(
            {
              actorAccountId: null,
              actorEmployeeId: null,
              action: "auth.session.refreshed",
              target: { type: "session", id: null },
              outcome: "denied",
              reasonCode: "invalid_token",
              now: command.now,
            },
            this.c.var.auditContext,
          ),
        )
      } catch (cause) {
        return auditUnavailable(cause)
      }

      return { reason: "invalid_token" }
    }

    const prepareFamilyAudit = async (props: {
      action: "auth.session.refreshed" | "auth.session.reuse_detected"
      actorAccountId: number | null
      actorEmployeeId: number | null
      outcome: "succeeded" | "denied"
      reasonCode: "invalid_token" | "refresh_token_reuse" | null
    }) => {
      const familyHash = await hashAuditIdentifier(
        `refresh-family:${existing.familyId}`,
        this.c.env.AUDIT_HMAC_SECRET,
      )
      const record = createAuditEvent(
        {
          ...props,
          target: { type: "account", id: String(existing.accountId) },
          metadata: { family_id_hash: familyHash },
          now: command.now,
        },
        this.c.var.auditContext,
      )

      return { familyHash, record }
    }

    if (existing.revokedAt !== null) {
      let auditStatements: ReturnType<AuditEventRepository["prepareAppend"]>
      try {
        const { record } = await prepareFamilyAudit({
          action: "auth.session.reuse_detected",
          actorAccountId: null,
          actorEmployeeId: null,
          outcome: "denied",
          reasonCode: "refresh_token_reuse",
        })
        auditStatements = auditRepository.prepareAppend(record)
      } catch (cause) {
        return auditUnavailable(cause)
      }
      const revokeResult = await refreshTokenRepository.revokeFamilyWithAudit({
        familyId: existing.familyId,
        nowEpoch,
        auditStatements,
      })
      if (revokeResult instanceof Error) return auditUnavailable(revokeResult)

      return { reason: "invalid_token" }
    }

    if (existing.expiresAt <= nowEpoch) {
      try {
        const { record } = await prepareFamilyAudit({
          action: "auth.session.refreshed",
          actorAccountId: null,
          actorEmployeeId: null,
          outcome: "denied",
          reasonCode: "invalid_token",
        })
        await auditRepository.append(record)
      } catch (cause) {
        return auditUnavailable(cause)
      }

      return { reason: "invalid_token" }
    }

    const canonicalAccountId = zAccountId.safeParse(String(existing.accountId))
    if (canonicalAccountId.success === false) {
      return new UnexpectedError("failed to authorize account session")
    }

    const accountPromise = new AccountEmployeeLinkRepository(this.c).findLinkedAccount(
      existing.accountId,
    )
    const canonicalSessionPromise = resolveAccountSession({
      accountRepository: new SystemAccountRepository({ database: this.c.env.DB }),
      accountId: canonicalAccountId.data,
      sessionTokenVersion: existing.tokenVersion,
    })
    const account = await accountPromise
    const canonicalSession = await canonicalSessionPromise

    if (account instanceof Error) {
      return new UnexpectedError("failed to find account", { cause: account })
    }

    if (canonicalSession instanceof Error) {
      return new UnexpectedError("failed to authorize account session", {
        cause: canonicalSession,
      })
    }

    const revokeInvalidFamily = async (): Promise<InvalidToken | UnavailableError> => {
      let auditStatements: ReturnType<AuditEventRepository["prepareAppend"]>
      try {
        const { record } = await prepareFamilyAudit({
          action: "auth.session.refreshed",
          actorAccountId: null,
          actorEmployeeId: null,
          outcome: "denied",
          reasonCode: "invalid_token",
        })
        auditStatements = auditRepository.prepareAppend(record)
      } catch (cause) {
        return auditUnavailable(cause)
      }
      const revokeResult = await refreshTokenRepository.revokeFamilyWithAudit({
        familyId: existing.familyId,
        nowEpoch,
        auditStatements,
      })
      if (revokeResult instanceof Error) return auditUnavailable(revokeResult)

      return { reason: "invalid_token" }
    }

    const accountSessionRejection =
      account === null
        ? null
        : getAccountSessionRejection({
            accountStatus: account.status,
            accountTokenVersion: account.tokenVersion,
            sessionTokenVersion: existing.tokenVersion,
          })

    if (
      account === null ||
      accountSessionRejection !== null ||
      canonicalSession.kind === "rejected" ||
      account.employeeId === null
    ) {
      return revokeInvalidFamily()
    }

    const employeeAccess = await resolveLiveEmployeeAccess(this.c, account.employeeId)
    if (employeeAccess instanceof ApplicationError) return employeeAccess
    if (employeeAccess === null) return revokeInvalidFamily()

    const accessToken = await new JoseTokenSigner().sign(
      {
        accountId: existing.accountId,
        tokenVersion: canonicalSession.account.tokenVersion,
      },
      command.jwtSecret,
    )
    if (accessToken instanceof Error) {
      return new UnexpectedError("failed to sign access token", { cause: accessToken })
    }

    const newRawRefreshToken = generateOpaqueToken()
    const newHashedToken = await refreshTokenHash(newRawRefreshToken)
    let audit: AuditDecisionAppendFragment<RefreshTokenRotationDecision>
    try {
      const familyHash = await hashAuditIdentifier(
        `refresh-family:${existing.familyId}`,
        this.c.env.AUDIT_HMAC_SECRET,
      )
      audit = auditRepository.prepareExclusiveAppend({
        decisionId: crypto.randomUUID(),
        cases: [
          {
            decision: "rotated",
            record: createAuditEvent(
              {
                actorAccountId: existing.accountId,
                actorEmployeeId: account.employeeId,
                action: "auth.session.refreshed",
                target: { type: "account", id: String(existing.accountId) },
                outcome: "succeeded",
                reasonCode: null,
                metadata: { family_id_hash: familyHash },
                now: command.now,
              },
              this.c.var.auditContext,
            ),
          },
          {
            decision: "reused",
            record: createAuditEvent(
              {
                actorAccountId: null,
                actorEmployeeId: null,
                action: "auth.session.reuse_detected",
                target: { type: "account", id: String(existing.accountId) },
                outcome: "denied",
                reasonCode: "refresh_token_reuse",
                metadata: { family_id_hash: familyHash },
                now: command.now,
              },
              this.c.var.auditContext,
            ),
          },
          {
            decision: "invalid",
            record: createAuditEvent(
              {
                actorAccountId: null,
                actorEmployeeId: null,
                action: "auth.session.refreshed",
                target: { type: "account", id: String(existing.accountId) },
                outcome: "denied",
                reasonCode: "invalid_token",
                metadata: { family_id_hash: familyHash },
                now: command.now,
              },
              this.c.var.auditContext,
            ),
          },
        ],
      })
    } catch (cause) {
      return auditUnavailable(cause)
    }

    const rotateResult = await refreshTokenRepository.rotateWithAudit(
      {
        tokenId: existing.id,
        oldTokenHash: hashedToken,
        newTokenHash: newHashedToken,
        accountId: existing.accountId,
        employeeId: account.employeeId,
        familyId: existing.familyId,
        tokenVersion: canonicalSession.account.tokenVersion,
        userAgent: command.userAgent,
        nowEpoch,
        lifecycleAccess: employeeAccess,
      },
      audit,
    )
    if (rotateResult instanceof Error) return auditUnavailable(rotateResult)
    if (rotateResult !== "rotated") return { reason: "invalid_token" }

    return { accessToken, refreshToken: newRawRefreshToken }
  }
}
