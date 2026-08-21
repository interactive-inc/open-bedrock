import type { Session } from "@/lib/auth/session"
import { createAdministrationAuditEvent } from "@/contexts/administration/application/audit/create-administration-audit-event"
import type { Context } from "@/env"
import { AuditEventRepository } from "@/contexts/administration/infrastructure/audit/audit-event.repository"
import { resolveOrganizationAuthority } from "@/contexts/company/infrastructure/organization/resolve-organization-authority.repository"

export type LifecycleReadAuthorization = {
  scope: "self" | "organization" | "all"
  auditAction: "employee.lifecycle.read" | "employee.lifecycle.read_all"
}

type Props = {
  c: Context
  session: Session
}

/**
 * 従業員ライフサイクル系ルートの認可解決と監査記録。
 * 本人・組織上の権限（レポートライン/部門長）・全社権限の順でスコープを解決し、
 * 読み取り成功と拒否を監査イベントに追記する
 */
export class LifecycleAccess {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  /** 読み取りの認可を解決する。権限が無ければ null（呼び出し側は 404 に倒す）。 */
  async resolveReadAuthorization(
    targetEmployeeId: number,
  ): Promise<LifecycleReadAuthorization | null | Error> {
    const session = this.props.session

    if (session.employeeId === targetEmployeeId) {
      return { scope: "self", auditAction: "employee.lifecycle.read" }
    }

    if (session.hasPermission("employee:lifecycle:read:all")) {
      return { scope: "all", auditAction: "employee.lifecycle.read_all" }
    }

    if (!session.hasPermission("employee:read")) return null

    const authority = await resolveOrganizationAuthority(
      this.props.c,
      session.employeeId,
      targetEmployeeId,
    )

    if (authority instanceof Error) return authority

    return authority.managementChain || authority.departmentManager
      ? { scope: "organization", auditAction: "employee.lifecycle.read" }
      : null
  }

  /** 発令適用のスコープを解決する。権限が無ければ null（呼び出し側は 404 に倒す）。 */
  async resolveApplyScope(
    targetEmployeeId: number,
  ): Promise<"all" | "organization" | null | Error> {
    const session = this.props.session

    if (!session.hasPermission("employee:lifecycle:apply")) return null

    if (session.hasPermission("employee:lifecycle:read:all")) return "all"

    const authority = await resolveOrganizationAuthority(
      this.props.c,
      session.employeeId,
      targetEmployeeId,
    )

    if (authority instanceof Error) return authority

    return authority.managementChain || authority.departmentManager ? "organization" : null
  }

  async appendReadAudit(input: {
    action: LifecycleReadAuthorization["auditAction"]
    targetEmployeeId: number
    scope: LifecycleReadAuthorization["scope"]
    resultCount: number
    filterFingerprint: string
  }): Promise<void> {
    await new AuditEventRepository(this.props.c).append(
      createAdministrationAuditEvent(
        {
          actorAccountId: this.props.session.accountId,
          actorEmployeeId: this.props.session.employeeId,
          action: input.action,
          target: { type: "employee", id: String(input.targetEmployeeId) },
          outcome: "succeeded",
          reasonCode: null,
          authorization: { scope: input.scope },
          metadata: {
            resultCount: input.resultCount,
            filterFingerprint: input.filterFingerprint,
          },
          now: this.now(),
        },
        this.props.c.var.auditContext,
      ),
    )
  }

  async appendDeniedAudit(input: {
    targetEmployeeId: number | null
    permission: "employee:lifecycle:apply" | "employee:lifecycle:read:all" | "employee:read"
    reasonCode: string
  }): Promise<void> {
    await new AuditEventRepository(this.props.c).append(
      createAdministrationAuditEvent(
        {
          actorAccountId: this.props.session.accountId,
          actorEmployeeId: this.props.session.employeeId,
          action: "employee.lifecycle.denied",
          target: {
            type: "employee",
            id: input.targetEmployeeId === null ? null : String(input.targetEmployeeId),
          },
          outcome: "denied",
          reasonCode: input.reasonCode,
          authorization: { permission: input.permission },
          now: this.now(),
        },
        this.props.c.var.auditContext,
      ),
    )
  }

  private now(): Date {
    return new Date(this.props.c.env.NOW ?? new Date().toISOString())
  }
}
