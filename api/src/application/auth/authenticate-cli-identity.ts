import type { AccessTokenView } from "@/application/auth/access-token-view"
import { IssueEmployeeSession } from "@/application/auth/issue-employee-session"
import { resolveLiveEmployeeAccess } from "@/application/auth/resolve-live-employee-access"
import { createAuditEvent } from "@/domain/audit/audit-event"
import type { Context } from "@/env"
import { AuditEventRepository } from "@/infrastructure/audit/audit-event-repository"
import { AccountProvisioner } from "@/infrastructure/iam/account-provisioner"
import { IdentityRepository } from "@/infrastructure/auth/identity-repository"
import { ApplicationError, ConflictError, UnexpectedError } from "@/lib/errors"

/** 外部 identity provider は OIDC ブローカー。identity の provider 値に対応する。 */
const EXTERNAL_PROVIDER = "oidc" as const

/** CLI ログイン経由で新規払い出しする従業員の初期ロール（seed の標準メンバーロール）。 */
const DEFAULT_ROLE_KEY = "member"

export type CliIdentityLoginCommand = {
  /** 検証済み外部トークンの sub。identity の subject に対応する。 */
  subject: string
  email: string
  name: string
  jwtSecret: string
  userAgent: string | null
  now: Date
}

export type AuthenticatedCliSession = AccessTokenView & {
  accountId: number
  employeeId: number
}

/** アカウントは存在するが停止・失効等でログインさせない。 */
export type CliIdentityLoginDenied = { reason: "account_inactive" }

/** セッション発行に必要な、解決済みアカウントの最小情報。既存 identity・新規プロビジョニング共通の形。 */
type ResolvedAccount = {
  accountId: number
  employeeId: number | null
  tokenVersion: number
  accountStatus: string
}

/**
 * 検証済みの外部 identity(sub)に対応するアカウントへアクセストークンを発行する。CLI ログイン専用。
 *
 * 既存の identity ログイン（AuthenticateIdentity）と異なり、対応するアカウントが無い場合は
 * その場で自動プロビジョニングする（email で既存従業員に紐付け、それも無ければ新規に払い出す）。
 * `gh auth login` 相当の体験として、初回 CLI ログインだけで社内アカウントが使えるようにする意図。
 * account が active でない・従業員が在籍でない場合は account_inactive として拒否する。
 * トークン発行は password ログインと同じ IssueEmployeeSession を再利用する。
 */
export class AuthenticateCliIdentity {
  constructor(private readonly c: Context) {}

  async run(
    command: CliIdentityLoginCommand,
  ): Promise<AuthenticatedCliSession | CliIdentityLoginDenied | ApplicationError> {
    const identityRepository = new IdentityRepository(this.c)

    const identity = await identityRepository.findByProviderSubject(
      EXTERNAL_PROVIDER,
      command.subject,
    )
    if (identity instanceof Error) {
      return new UnexpectedError("failed to find identity", { cause: identity })
    }

    const resolved =
      identity === null
        ? await this.provision(command)
        : {
            accountId: identity.accountId,
            employeeId: identity.employeeId,
            tokenVersion: identity.tokenVersion,
            accountStatus: identity.accountStatus,
          }

    if (resolved instanceof ApplicationError) return resolved

    if (resolved.employeeId === null) {
      return { reason: "account_inactive" }
    }

    if (resolved.accountStatus !== "active") {
      return { reason: "account_inactive" }
    }

    const employeeAccess = await resolveLiveEmployeeAccess(this.c, resolved.employeeId)
    if (employeeAccess instanceof ApplicationError) return employeeAccess
    if (employeeAccess === null) {
      return { reason: "account_inactive" }
    }

    return new IssueEmployeeSession(this.c).run({
      accountId: resolved.accountId,
      employeeId: resolved.employeeId,
      tokenVersion: resolved.tokenVersion,
      jwtSecret: command.jwtSecret,
      userAgent: command.userAgent,
      now: command.now,
      successAction: "auth.session.cli_login_succeeded",
    })
  }

  /**
   * identity が未登録の場合の自動プロビジョニング。email で既存従業員が見つかればそれに紐付け、
   * 見つからなければ従業員一式（code=null）を新規に払い出す。SyncExternalIdentities の同名分岐と
   * 同じ規則（email 一致優先、無ければ新規payout）を踏襲する。
   */
  private async provision(
    command: CliIdentityLoginCommand,
  ): Promise<ResolvedAccount | ApplicationError> {
    const identityRepository = new IdentityRepository(this.c)
    const provisioner = new AccountProvisioner(this.c)
    const nowEpoch = Math.floor(command.now.getTime() / 1_000)

    const linkedAccountId = await identityRepository.findAccountIdByEmail(command.email)
    if (linkedAccountId instanceof Error) {
      return new UnexpectedError("failed to look up account by email", { cause: linkedAccountId })
    }

    if (linkedAccountId !== null) {
      const attached = await provisioner.attachExternalIdentity({
        accountId: linkedAccountId,
        provider: EXTERNAL_PROVIDER,
        subject: command.subject,
        email: command.email,
        now: nowEpoch,
      })
      if (attached instanceof Error) {
        if (attached.message.includes("UNIQUE constraint")) {
          return new ConflictError("external identity already exists", "identity_conflict")
        }
        return new UnexpectedError("failed to attach external identity", { cause: attached })
      }
    } else {
      const employeeId = await provisioner.provisionExternalEmployee({
        provider: EXTERNAL_PROVIDER,
        subject: command.subject,
        email: command.email,
        name: command.name,
        roleKey: DEFAULT_ROLE_KEY,
        now: nowEpoch,
      })
      if (employeeId instanceof Error) {
        if (employeeId.message.includes("UNIQUE constraint")) {
          return new ConflictError("external identity already exists", "identity_conflict")
        }
        return new UnexpectedError("failed to provision external employee", { cause: employeeId })
      }
    }

    const provisioned = await identityRepository.findByProviderSubject(
      EXTERNAL_PROVIDER,
      command.subject,
    )
    if (provisioned instanceof Error) {
      return new UnexpectedError("failed to find provisioned identity", { cause: provisioned })
    }
    if (provisioned === null) {
      return new UnexpectedError("provisioned identity is missing immediately after creation")
    }

    try {
      const record = createAuditEvent(
        {
          actorAccountId: null,
          actorEmployeeId: null,
          action: "iam.identity.provisioned",
          target: { type: "identity", id: String(provisioned.accountId) },
          outcome: "succeeded",
          reasonCode: null,
          metadata: { employee_id: provisioned.employeeId },
          now: command.now,
        },
        this.c.var.auditContext,
      )
      await new AuditEventRepository(this.c).append(record)
    } catch (cause) {
      return new UnexpectedError("failed to record provisioning audit", { cause })
    }

    return {
      accountId: provisioned.accountId,
      employeeId: provisioned.employeeId,
      tokenVersion: provisioned.tokenVersion,
      accountStatus: provisioned.accountStatus,
    }
  }
}
