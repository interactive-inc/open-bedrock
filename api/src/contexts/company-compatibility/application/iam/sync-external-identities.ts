import { createAuditEvent } from "@/contexts/company-compatibility/application/audit/company-audit-event"
import type { AuditAction } from "@/contexts/company-compatibility/application/audit/company-audit-event"
import type { Context } from "@/env"
import { AuditEventRepository } from "@/contexts/company-compatibility/infrastructure/company/audit/audit-event-repository"
import { IdentityRepository } from "@/contexts/company-compatibility/infrastructure/auth/identity-repository"
import { AccountProvisioner } from "@/contexts/company-compatibility/infrastructure/iam/account-provisioner"
import { ApplicationError, ConflictError, UnexpectedError } from "@/lib/errors"

/** 外部 identity provider は OIDC ブローカー。identity の provider 値に対応する。 */
const EXTERNAL_PROVIDER = "oidc" as const

/** プロビジョニングで払い出す初期ロール（seed の標準メンバーロール）。 */
const DEFAULT_ROLE_KEY = "member"

export type ExternalIdentityInput = {
  /** 外部 IdP の sub。identity の subject に対応する。 */
  subject: string
  email: string
  name: string
}

export type SyncOutcome = "created" | "updated" | "skipped"

export type SyncSummary = {
  created: number
  updated: number
  skipped: number
}

/**
 * 外部 identity provider からの同期（プロビジョニング）を冪等に適用する。
 *
 * - (provider=oidc, subject) が既にあれば email/name を更新（差分が無ければ skip）。
 * - 無ければ email で既存従業員を探し、見つかれば identity を追加して紐付ける。
 * - どちらも無ければ従業員(code=null)・アカウント・identity・初期ロールを新規に払い出す。
 *
 * ログイン時の自動作成はせず、事前同期でのみアカウントを作る招待制を担保する。
 */
export class SyncExternalIdentities {
  constructor(private readonly c: Context) {}

  async run(
    inputs: ReadonlyArray<ExternalIdentityInput>,
    now: Date,
  ): Promise<SyncSummary | ApplicationError> {
    const summary: SyncSummary = { created: 0, updated: 0, skipped: 0 }

    for (const input of inputs) {
      const outcome = await this.applyOne(input, now)
      if (outcome instanceof ApplicationError) return outcome

      summary[outcome] += 1
    }

    return summary
  }

  private async applyOne(
    input: ExternalIdentityInput,
    now: Date,
  ): Promise<SyncOutcome | ApplicationError> {
    const identityRepository = new IdentityRepository(this.c)
    const nowEpoch = Math.floor(now.getTime() / 1_000)

    const existing = await identityRepository.findByProviderSubject(
      EXTERNAL_PROVIDER,
      input.subject,
    )
    if (existing instanceof Error) {
      return new UnexpectedError("failed to look up external identity", { cause: existing })
    }

    if (existing !== null) {
      // email も name も一致していれば書き込みも監査も行わず skip する（冪等な再送のno-op）。
      const unchanged =
        existing.email === input.email &&
        (existing.employeeId === null || existing.employeeName === input.name)
      if (unchanged) {
        return "skipped"
      }

      const updated = await identityRepository.updateProvisionedIdentity(
        existing.identityId,
        existing.employeeId,
        input.email,
        input.name,
      )
      if (updated instanceof Error) {
        return new UnexpectedError("failed to update external identity", { cause: updated })
      }

      const auditError = await this.audit(
        "iam.identity.provision_updated",
        existing.accountId,
        existing.employeeId,
        now,
      )
      if (auditError instanceof ApplicationError) return auditError

      return "updated"
    }

    // 既存従業員を email で探し、見つかれば identity を追加して紐付ける。
    const linkedAccountId = await identityRepository.findAccountIdByEmail(input.email)
    if (linkedAccountId instanceof Error) {
      return new UnexpectedError("failed to look up account by email", { cause: linkedAccountId })
    }

    const provisioner = new AccountProvisioner(this.c)

    if (linkedAccountId !== null) {
      const attached = await provisioner.attachExternalIdentity({
        accountId: linkedAccountId,
        provider: EXTERNAL_PROVIDER,
        subject: input.subject,
        email: input.email,
        now: nowEpoch,
      })
      if (attached instanceof Error) {
        if (attached.message.includes("UNIQUE constraint")) {
          return new ConflictError("external identity already exists", "identity_conflict")
        }
        return new UnexpectedError("failed to attach external identity", { cause: attached })
      }

      const linked = await identityRepository.findByProviderSubject(
        EXTERNAL_PROVIDER,
        input.subject,
      )
      const employeeId = linked instanceof Error || linked === null ? null : linked.employeeId

      const auditError = await this.audit(
        "iam.identity.provisioned",
        linkedAccountId,
        employeeId,
        now,
      )
      if (auditError instanceof ApplicationError) return auditError

      return "created"
    }

    // 従業員も無ければ新規に一式を払い出す（code=null）。
    const employeeId = await provisioner.provisionExternalEmployee({
      provider: EXTERNAL_PROVIDER,
      subject: input.subject,
      email: input.email,
      name: input.name,
      roleKey: DEFAULT_ROLE_KEY,
      now: nowEpoch,
    })
    if (employeeId instanceof Error) {
      if (employeeId.message.includes("UNIQUE constraint")) {
        return new ConflictError("external identity already exists", "identity_conflict")
      }
      return new UnexpectedError("failed to provision external employee", { cause: employeeId })
    }

    const created = await identityRepository.findByProviderSubject(EXTERNAL_PROVIDER, input.subject)
    const createdAccountId = created instanceof Error || created === null ? null : created.accountId

    const auditError = await this.audit(
      "iam.identity.provisioned",
      createdAccountId,
      employeeId,
      now,
    )
    if (auditError instanceof ApplicationError) return auditError

    return "created"
  }

  private async audit(
    action: AuditAction,
    accountId: number | null,
    employeeId: number | null,
    now: Date,
  ): Promise<null | ApplicationError> {
    try {
      const record = createAuditEvent(
        {
          actorAccountId: null,
          actorEmployeeId: null,
          action,
          target: { type: "identity", id: accountId === null ? null : String(accountId) },
          outcome: "succeeded",
          reasonCode: null,
          metadata: { employee_id: employeeId },
          now,
        },
        this.c.var.auditContext,
      )
      await new AuditEventRepository(this.c).append(record)

      return null
    } catch (cause) {
      return new UnexpectedError("failed to record provisioning audit", { cause })
    }
  }
}
