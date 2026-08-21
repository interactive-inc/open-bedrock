import type { Session } from "@/contexts/company/domain/iam/session"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
} from "@/lib/errors"
import type { Context } from "@/env"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle.repository"
import { OrgDepartmentRepository } from "@/contexts/company/infrastructure/organization/org-department.repository"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"

export type Command = {
  session: Session
  code: string
}

export type Deleted = { reason: "archived" }

/**
 * 部署は物理削除せず、現在・未来の所属と責任がない場合だけアーカイブする。
 * 過去の人事履歴と参照整合性は保持する。
 */
export class DeleteOrgDepartment {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | ApplicationError> {
    const departmentRepository = new OrgDepartmentRepository(this.c)

    if (command.session.hasPermission("org:manage") === false) {
      return new ForbiddenError("cannot manage org", "forbidden")
    }

    const current = await departmentRepository.findByCode(command.code)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find department", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("department not found", "department_not_found")
    }

    const migrationStatus = await new EmployeeLifecycleRepository(this.c).migrationStatus()
    if (migrationStatus instanceof ApplicationError) return migrationStatus
    if (migrationStatus !== "verified") {
      return new ConflictError("employee lifecycle migration is incomplete", "department_in_use")
    }
    const businessDate = resolveCompanyBusinessDate({
      now: this.c.env.NOW ?? new Date().toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (typeof businessDate !== "string") {
      return new UnexpectedError("failed to resolve company business date", {
        cause: businessDate,
      })
    }
    const archivedAt = Math.floor(Date.parse(this.c.env.NOW ?? new Date().toISOString()) / 1_000)
    const db = this.c.env.DB
    try {
      await db.batch([
        db
          .prepare(
            `UPDATE org_departments
             SET archived_at = ?2, archived_by_account_id = ?3
             WHERE code = ?1 AND archived_at IS NULL
               AND NOT EXISTS (
                 SELECT 1 FROM org_departments child
                 WHERE child.parent_code = ?1 AND child.archived_at IS NULL
               )
               AND NOT EXISTS (
                 SELECT 1 FROM employee_org_assignment_period_versions assignment
                 WHERE assignment.department_code = ?1
                   AND assignment.is_void = 0
                   AND assignment.revision = (
                     SELECT MAX(candidate.revision)
                     FROM employee_org_assignment_period_versions candidate
                     WHERE candidate.period_id = assignment.period_id
                   )
                   AND (assignment.ends_on IS NULL OR assignment.ends_on > ?4)
               )
               AND NOT EXISTS (
                 SELECT 1 FROM employee_org_responsibility_period_versions responsibility
                 WHERE responsibility.department_code = ?1
                   AND responsibility.is_void = 0
                   AND responsibility.revision = (
                     SELECT MAX(candidate.revision)
                     FROM employee_org_responsibility_period_versions candidate
                     WHERE candidate.period_id = responsibility.period_id
                   )
                   AND (responsibility.ends_on IS NULL OR responsibility.ends_on > ?4)
               )
             RETURNING code`,
          )
          .bind(command.code, archivedAt, command.session.accountId, businessDate),
        abortWhenPreviousStatementChangedNoRows(db),
      ])
      return { reason: "archived" }
    } catch (cause) {
      return isAbortedByGuard(cause)
        ? new ConflictError(
            "department has current or future organization facts or child departments",
            "department_in_use",
          )
        : new UnexpectedError("failed to archive department", { cause })
    }
  }
}
