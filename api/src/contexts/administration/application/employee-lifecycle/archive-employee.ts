import type { Session } from "@/lib/auth/session"
import { GetLifecycleState } from "@/contexts/company/infrastructure/employee-lifecycle/get-lifecycle-state.repository"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { createAdministrationAuditEvent } from "@/contexts/administration/domain/factories/administration-audit-event.factory"
import type { Context } from "@/env"
import { ArchiveEmployeeAdapter } from "@/contexts/administration/infrastructure/adapters/employee-lifecycle/archive-employee.adapter"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle.repository"
import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee.repository"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
} from "@/lib/errors"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"

export class ArchiveEmployee {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

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
      return new UnexpectedError("会社営業日を解決できません", {
        cause: businessDate,
      })
    }
    const [state, schedule] = await Promise.all([
      new GetLifecycleState(this.c).run({
        employeeId: employee.id,
        asOf: businessDate,
      }),
      new EmployeeLifecycleRepository(this.c).loadSchedule(employee.id),
    ])
    if (state instanceof CompanyOperationError) {
      return new UnexpectedError("従業員の人事状態を取得できません", {
        cause: state,
      })
    }
    if (schedule instanceof CompanyOperationError) {
      return new UnexpectedError("従業員の人事履歴を取得できません", {
        cause: schedule,
      })
    }
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
    const archiveAdapter = new ArchiveEmployeeAdapter(this.c)
    const account = await archiveAdapter.loadAccount(employee.id, businessDate)
    if (account === "future_manager_assignment") {
      return new ConflictError(
        "将来の上司割当がある従業員はアーカイブできません",
        "employee_not_retired",
      )
    }
    if (account instanceof Error) {
      return new UnexpectedError("従業員のSystem Accountを取得できません", {
        cause: account,
      })
    }
    const archivedAt = new Date(command.archivedAt)
    const audit = createAdministrationAuditEvent(
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
    const archived = await archiveAdapter.archive({
      employeeId: employee.id,
      employeeCode: employee.code,
      employeeRevision: state.employeeRevision,
      accountId: account.id,
      actorAccountId: command.session.accountId,
      archivedAt,
      audit,
    })
    if (archived === "archived") return { status: "archived" }
    if (archived === "last_admin") {
      return new ConflictError("最後の実効管理者はアーカイブできません", "last_admin")
    }
    if (archived === "forbidden") {
      return new ForbiddenError("System Accountを停止する権限がありません", "forbidden")
    }
    return archived === "stale"
      ? new ConflictError("従業員情報が更新されています", "personnel_action_stale")
      : new UnexpectedError("従業員をアーカイブできません", { cause: archived })
  }
}
