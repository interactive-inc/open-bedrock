import type { Session } from "@/contexts/company/domain/iam/session"
import { GetLifecycleState } from "@/contexts/company/infrastructure/employee-lifecycle/get-lifecycle-state.repository"
import { createAuditEvent } from "@/contexts/company/domain/audit/company-audit-event"
import type { Context } from "@/env"
import { AuditEventRepository } from "@/contexts/company/infrastructure/audit/audit-event.repository"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle.repository"
import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee.repository"
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
import { EFFECTIVE_ROOT_PERMISSION_KEYS } from "@/contexts/company/domain/iam/effective-root-permission-key.catalog"
import { zAccountId } from "@system/domain/auth/account-id"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account.repository"
import { PrepareSystemAccountSuspension } from "@system/infrastructure/iam/prepare-system-account-suspension.repository"

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
    const accountIdValue = await this.c.env.DB.prepare(
      "SELECT account_id FROM account_employee_links WHERE employee_id = ?1",
    )
      .bind(employee.id)
      .first<string>("account_id")
    const accountId = zAccountId.safeParse(accountIdValue)
    if (!accountId.success) {
      return new UnexpectedError("従業員のSystem Accountを取得できません")
    }
    const account = await new SystemAccountRepository({ database: this.c.env.DB }).findById(
      accountId.data,
    )
    if (account === null || account instanceof Error) {
      return new UnexpectedError("従業員のSystem Accountを取得できません", {
        cause: account instanceof Error ? account : undefined,
      })
    }
    const archivedAt = new Date(command.archivedAt)
    const systemStatements = new PrepareSystemAccountSuspension({
      env: { DB: this.c.env.DB },
    }).prepare({
      actorAccountId: command.session.accountId,
      targetAccountId: account.id,
      protectedPermissionKeys: EFFECTIVE_ROOT_PERMISSION_KEYS,
      now: archivedAt,
    })
    if (systemStatements instanceof Error) {
      return new UnexpectedError("System Account停止を準備できません", { cause: systemStatements })
    }
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
          accountId: account.id,
          tokenVersion: account.tokenVersion,
        },
        after: {
          employeeCode: employee.code,
          status: "archived",
          accountId: account.id,
          tokenVersion: account.tokenVersion + 1,
        },
        now: new Date(command.archivedAt),
      },
      this.c.var.auditContext,
    )
    try {
      await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `UPDATE employees SET archived_at = ?2, archived_by_account_id = ?3
             WHERE id = ?1 AND archived_at IS NULL AND status = 'retired'
               AND COALESCE((SELECT revision FROM employee_lifecycle_revisions
                             WHERE employee_id = ?1), 0) = ?4
             RETURNING id`,
        ).bind(employee.id, archivedAtSeconds, command.session.accountId, state.employeeRevision),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        ...systemStatements,
        this.c.env.DB.prepare("DELETE FROM org_memberships WHERE employee_code = ?1").bind(
          employee.code,
        ),
        ...new AuditEventRepository(this.c).prepareAppend(audit),
      ])
      return { status: "archived" }
    } catch (cause) {
      if (cause instanceof Error && cause.message.includes("malformed JSON")) {
        return new ConflictError("最後の実効管理者はアーカイブできません", "last_admin")
      }
      if (cause instanceof Error && cause.message.includes("integer overflow")) {
        return new ForbiddenError("System Accountを停止する権限がありません", "forbidden")
      }
      return isAbortedByGuard(cause)
        ? new ConflictError("従業員情報が更新されています", "personnel_action_stale")
        : new UnexpectedError("従業員をアーカイブできません", { cause })
    }
  }
}
