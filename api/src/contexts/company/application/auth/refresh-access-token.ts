import type { AccessTokenView } from "@system/domain/auth/access-token-view"
import { AccountEmployeeLinkRepository } from "@/contexts/company/infrastructure/employee/account-employee-link-repository"
import { JoseTokenSigner } from "@/contexts/company/application/auth/jose-token-signer"
import { resolveLiveEmployeeAccess } from "@/contexts/company/application/auth/resolve-live-employee-access"
import type { Context } from "@/env"
import { ApplicationError, UnavailableError, UnexpectedError } from "@/lib/errors"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { createSystemSessionApplications } from "@system/infrastructure/auth/create-system-session-applications"

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
 * canonical System Sessionをrotationし、製品固有のEmployee有効性をaccess token発行前に確認する。
 * Session・再利用検知・family失効・監査はSystemが所有し、Companyは上位の利用資格だけを判定する。
 */
export class RefreshAccessToken {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<AccessTokenView | InvalidToken | ApplicationError> {
    const applications = createSystemSessionApplications({
      context: { env: { DB: this.c.env.DB } },
      sessionTtlMilliseconds: 7 * 24 * 60 * 60 * 1_000,
    })
    if (applications instanceof Error) {
      return new UnexpectedError("failed to configure account session", { cause: applications })
    }

    const metadataJson = toStableSystemAuditJson({
      client_ip: this.c.var.auditContext.clientIp,
      client_name: this.c.var.auditContext.clientName,
      request_id: this.c.var.auditContext.requestId,
    })
    if (metadataJson instanceof Error) return auditUnavailable(metadataJson)
    const auditContext = { authorizationJson: null, metadataJson }

    const authenticated = await applications.authenticate.execute({
      rawToken: command.refreshToken,
      now: command.now,
    })
    if (authenticated instanceof Error) {
      return new UnexpectedError("failed to authenticate refresh token", { cause: authenticated })
    }
    if (authenticated.kind === "rejected") {
      const rejectedRotation = await applications.rotate.execute({
        rawToken: command.refreshToken,
        now: command.now,
        auditContext,
      })
      if (rejectedRotation instanceof Error) return auditUnavailable(rejectedRotation)
      return { reason: "invalid_token" }
    }

    const accountId = Number(authenticated.accountId)
    if (
      !Number.isSafeInteger(accountId) ||
      accountId <= 0 ||
      String(accountId) !== authenticated.accountId
    ) {
      const revoked = await applications.revoke.execute({
        rawToken: command.refreshToken,
        now: command.now,
        auditContext,
      })
      return revoked instanceof Error ? auditUnavailable(revoked) : { reason: "invalid_token" }
    }

    const account = await new AccountEmployeeLinkRepository(this.c).findLinkedAccount(accountId)
    if (account instanceof Error) {
      return new UnexpectedError("failed to find account", { cause: account })
    }
    if (
      account === null ||
      account.status !== "active" ||
      account.tokenVersion !== authenticated.tokenVersion ||
      account.employeeId === null
    ) {
      const revoked = await applications.revoke.execute({
        rawToken: command.refreshToken,
        now: command.now,
        auditContext,
      })
      return revoked instanceof Error ? auditUnavailable(revoked) : { reason: "invalid_token" }
    }

    const employeeAccess = await resolveLiveEmployeeAccess(this.c, account.employeeId)
    if (employeeAccess instanceof ApplicationError) return employeeAccess
    if (employeeAccess === null) {
      const revoked = await applications.revoke.execute({
        rawToken: command.refreshToken,
        now: command.now,
        auditContext,
      })
      return revoked instanceof Error ? auditUnavailable(revoked) : { reason: "invalid_token" }
    }

    const rotated = await applications.rotate.execute({
      rawToken: command.refreshToken,
      now: command.now,
      auditContext,
    })
    if (rotated instanceof Error) return auditUnavailable(rotated)
    if (rotated.kind === "rejected") return { reason: "invalid_token" }

    const accessToken = await new JoseTokenSigner().sign(
      { accountId, tokenVersion: rotated.tokenVersion },
      command.jwtSecret,
    )
    if (accessToken instanceof Error) {
      const revoked = await applications.revoke.execute({
        rawToken: rotated.rawToken,
        now: command.now,
        auditContext,
      })
      return revoked instanceof Error
        ? auditUnavailable(revoked)
        : new UnexpectedError("failed to sign access token", { cause: accessToken })
    }

    return { accessToken, refreshToken: rotated.rawToken }
  }
}
