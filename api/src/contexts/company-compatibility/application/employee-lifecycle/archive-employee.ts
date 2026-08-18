import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { GetLifecycleState } from "@/contexts/company-compatibility/application/employee-lifecycle/get-lifecycle-state"
import { createAuditEvent } from "@/contexts/company-compatibility/application/audit/company-audit-event"
import type { Context } from "@/env"
import { AuditEventRepository } from "@/contexts/company-compatibility/infrastructure/company/audit/audit-event-repository"
import { EmployeeLifecycleRepository } from "@/contexts/company-compatibility/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { EmployeeRepository } from "@/contexts/company-compatibility/infrastructure/employee/employee-repository"
import { LastRootGuard } from "@/contexts/company-compatibility/infrastructure/iam/last-root-guard"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
} from "@/lib/errors"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"

export class ArchiveEmployee {
  constructor(private readonly c: Context) {}

  async run(command: {
    session: Session
    employeeCode: string
    archivedAt: string
  }): Promise<{ status: "archived" } | ApplicationError> {
    if (!command.session.hasPermission("employee:archive")) {
      return new ForbiddenError("従業員をアーカイブする権限がありません", "forbidden")
    }
    const employee = await new EmployeeRepository(this.c).findByCode(command.employeeCode)
    if (employee instanceof Error) {
      return new UnexpectedError("従業員を取得できません", { cause: employee })
    }
    if (employee === null) {
      return new NotFoundError("従業員が見つかりません", "employee_not_found")
    }
    if (employee.id === command.session.employeeId) {
      return new ForbiddenError("自分自身はアーカイブできません", "self_archive")
    }
    const businessDate = resolveCompanyBusinessDate({
      now: command.archivedAt,
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (typeof businessDate !== "string") {
      return new UnexpectedError("会社営業日を解決できません", { cause: businessDate })
    }
    const [state, schedule] = await Promise.all([
      new GetLifecycleState(this.c).run({ employeeId: employee.id, asOf: businessDate }),
      new EmployeeLifecycleRepository(this.c).loadSchedule(employee.id),
    ])
    if (state instanceof ApplicationError) return state
    if (schedule instanceof ApplicationError) return schedule
    if (state.archived) {
      return new ConflictError("従業員はすでにアーカイブされています", "already_archived")
    }
    if (state.status !== "retired") {
      return new ConflictError("退職済みの従業員だけをアーカイブできます", "employee_not_retired")
    }
    if (
      schedule.employments.some((period) => period.startsOn > businessDate) ||
      schedule.responsibilities.some(
        (period) => period.endsOn === null || period.endsOn > businessDate,
      )
    ) {
      return new ConflictError(
        "将来の雇用または組織責任がある従業員はアーカイブできません",
        "employee_not_retired",
      )
    }
    const futureManagerAssignment = await this.c.env.DB.prepare(
      `SELECT 1 AS found FROM employee_org_assignment_period_versions assignment
       WHERE assignment.manager_employee_id = ?1 AND assignment.starts_on > ?2
         AND assignment.is_void = 0
         AND assignment.revision = (
           SELECT MAX(candidate.revision) FROM employee_org_assignment_period_versions candidate
           WHERE candidate.period_id = assignment.period_id
         ) LIMIT 1`,
    )
      .bind(employee.id, businessDate)
      .first<number>("found")
    if (futureManagerAssignment === 1) {
      return new ConflictError(
        "将来の上司割当がある従業員はアーカイブできません",
        "employee_not_retired",
      )
    }
    const account = await this.c.env.DB.prepare(
      `SELECT account.id, account.token_version
       FROM system_accounts account
       JOIN account_employee_links link ON link.account_id = account.id
       WHERE link.employee_id = ?1`,
    )
      .bind(employee.id)
      .first<{ id: number; token_version: number }>()
    const archivedAtSeconds = Math.floor(Date.parse(command.archivedAt) / 1_000)
    const audit = createAuditEvent(
      {
        actorAccountId: command.session.accountId,
        actorEmployeeId: command.session.employeeId,
        action: "employee.archived",
        target: { type: "employee", id: String(employee.id) },
        outcome: "succeeded",
        reasonCode: null,
        authorization: { permission: "employee:archive" },
        before: {
          employeeCode: employee.code,
          status: state.status,
          accountId: account?.id ?? null,
          tokenVersion: account?.token_version ?? null,
        },
        after: {
          employeeCode: employee.code,
          status: "archived",
          accountId: account?.id ?? null,
          tokenVersion: account === null ? null : account.token_version + 1,
        },
        now: new Date(command.archivedAt),
      },
      this.c.var.auditContext,
    )
    try {
      await this.c.env.DB.batch([
        new LastRootGuard(this.c).abortWhenRemovingLoginEnabledEffectiveRootWouldLeaveNone(
          employee.id,
        ),
        this.c.env.DB.prepare(
          `UPDATE employees SET archived_at = ?2, archived_by_account_id = ?3
             WHERE id = ?1 AND archived_at IS NULL AND status = 'retired'
               AND COALESCE((SELECT revision FROM employee_lifecycle_revisions
                             WHERE employee_id = ?1), 0) = ?4
             RETURNING id`,
        ).bind(employee.id, archivedAtSeconds, command.session.accountId, state.employeeRevision),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        this.c.env.DB.prepare(
          `UPDATE system_accounts SET status = 'suspended', token_version = token_version + 1,
                                 updated_at = ?2
             WHERE id = (
               SELECT account_id FROM account_employee_links WHERE employee_id = ?1
             )`,
        ).bind(employee.id, archivedAtSeconds),
        this.c.env.DB.prepare("DELETE FROM org_memberships WHERE employee_code = ?1").bind(
          employee.code,
        ),
        ...new AuditEventRepository(this.c).prepareAppend(audit),
      ])
      return { status: "archived" }
    } catch (cause) {
      if (LastRootGuard.isAbortedBy(cause)) {
        return new ConflictError("最後の実効管理者はアーカイブできません", "last_admin")
      }
      return isAbortedByGuard(cause)
        ? new ConflictError("従業員情報が更新されています", "personnel_action_stale")
        : new UnexpectedError("従業員をアーカイブできません", { cause })
    }
  }
}
