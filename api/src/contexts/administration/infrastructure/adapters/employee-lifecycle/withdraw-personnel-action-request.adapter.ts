import type { Context } from "@/env"
import type { AuditEventRecord } from "@/contexts/administration/domain/factories/administration-audit-event.factory"
import { AuditEventAdapter } from "@/contexts/administration/infrastructure/adapters/audit/audit-event.adapter"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { prepareSystemProcedureCancellation } from "@system/infrastructure/workflow/prepare-system-procedure-cancellation.repository"

/** Company申請とSystem workflowの取り下げを一つのtransactionへ束ねる。 */
export class WithdrawPersonnelActionRequestAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async withdraw(input: {
    requestId: string
    applicationId: number
    employeeId: number
    accountId: AccountId
    withdrawnAt: Date
    audit: AuditEventRecord
  }): Promise<"withdrawn" | "conflict" | Error> {
    const cancellationStatements = prepareSystemProcedureCancellation(
      { env: { DB: this.c.env.DB } },
      {
        number: input.applicationId,
        createdByAccountId: input.accountId,
        cancelledAt: input.withdrawnAt,
      },
    )
    if (cancellationStatements instanceof Error) return cancellationStatements

    try {
      await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `UPDATE personnel_action_requests
             SET withdrawn_at = ?2, withdrawn_by_employee_id = ?3
             WHERE id = ?1 AND withdrawn_at IS NULL AND applied_action_id IS NULL
               AND requested_by_employee_id = ?3
             RETURNING id`,
        ).bind(input.requestId, Math.floor(input.withdrawnAt.getTime() / 1_000), input.employeeId),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        ...cancellationStatements,
        ...new AuditEventAdapter(this.c).prepareAppend(input.audit),
      ])
      return "withdrawn"
    } catch (cause) {
      return isAbortedByGuard(cause)
        ? "conflict"
        : cause instanceof Error
          ? cause
          : new Error("failed to withdraw personnel action request")
    }
  }
}
