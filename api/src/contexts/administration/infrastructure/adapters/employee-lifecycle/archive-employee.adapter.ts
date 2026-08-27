import type { Context } from "@/env"
import type { AuditEventRecord } from "@/contexts/administration/domain/factories/administration-audit-event.factory"
import { EFFECTIVE_ROOT_PERMISSION_KEYS } from "@/contexts/administration/domain/catalogs/effective-root-permission-key.catalog"
import { AuditEventAdapter } from "@/contexts/administration/infrastructure/adapters/audit/audit-event.adapter"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account.repository"
import { PrepareSystemAccountSuspension } from "@system/infrastructure/iam/prepare-system-account-suspension.repository"

/** Employee archiveとSystem Account停止を一つの技術境界へ隔離する。 */
export class ArchiveEmployeeAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async loadAccount(employeeId: number, businessDate: string) {
    try {
      const futureManagerAssignment = await this.c.env.DB.prepare(
        `SELECT 1 AS found FROM employee_org_assignment_period_versions assignment
         WHERE assignment.manager_employee_id = ?1 AND assignment.starts_on > ?2
           AND assignment.is_void = 0
           AND assignment.revision = (
             SELECT MAX(candidate.revision) FROM employee_org_assignment_period_versions candidate
             WHERE candidate.period_id = assignment.period_id
           ) LIMIT 1`,
      )
        .bind(employeeId, businessDate)
        .first<number>("found")
      if (futureManagerAssignment === 1) return "future_manager_assignment" as const

      const accountIdValue = await this.c.env.DB.prepare(
        "SELECT account_id FROM account_employee_links WHERE employee_id = ?1",
      )
        .bind(employeeId)
        .first<string>("account_id")
      const accountId = zAccountId.safeParse(accountIdValue)
      if (!accountId.success) return new Error("employee System Account link is invalid")

      const account = await new SystemAccountRepository({
        database: this.c.env.DB,
      }).findById(accountId.data)
      return account ?? new Error("employee System Account is missing")
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to load employee archive account")
    }
  }

  async archive(input: {
    employeeId: number
    employeeCode: string
    employeeRevision: number
    accountId: AccountId
    actorAccountId: AccountId
    archivedAt: Date
    audit: AuditEventRecord
  }): Promise<"archived" | "last_admin" | "forbidden" | "stale" | Error> {
    const systemStatements = new PrepareSystemAccountSuspension({
      env: { DB: this.c.env.DB },
    }).prepare({
      actorAccountId: input.actorAccountId,
      targetAccountId: input.accountId,
      protectedPermissionKeys: EFFECTIVE_ROOT_PERMISSION_KEYS,
      now: input.archivedAt,
    })
    if (systemStatements instanceof Error) return systemStatements

    try {
      await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `UPDATE employees SET archived_at = ?2, archived_by_account_id = ?3
             WHERE id = ?1 AND archived_at IS NULL AND status = 'retired'
               AND COALESCE((SELECT revision FROM employee_lifecycle_revisions
                             WHERE employee_id = ?1), 0) = ?4
             RETURNING id`,
        ).bind(
          input.employeeId,
          Math.floor(input.archivedAt.getTime() / 1_000),
          input.actorAccountId,
          input.employeeRevision,
        ),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        ...systemStatements,
        this.c.env.DB.prepare("DELETE FROM org_memberships WHERE employee_code = ?1").bind(
          input.employeeCode,
        ),
        ...new AuditEventAdapter(this.c).prepareAppend(input.audit),
      ])
      return "archived"
    } catch (cause) {
      if (cause instanceof Error && cause.message.includes("malformed JSON")) return "last_admin"
      if (cause instanceof Error && cause.message.includes("integer overflow")) return "forbidden"
      return isAbortedByGuard(cause)
        ? "stale"
        : cause instanceof Error
          ? cause
          : new Error("failed to archive employee")
    }
  }
}
