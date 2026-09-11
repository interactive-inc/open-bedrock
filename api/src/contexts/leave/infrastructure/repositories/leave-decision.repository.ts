import type { Context } from "@/env"
import {
  LeaveRequest,
  leaveRequestRowSchema,
} from "@/contexts/leave/domain/entities/leave-request.entity"
import { toLeaveDecisionSnapshot } from "@/contexts/leave/domain/definitions/to-leave-decision-snapshot.definition"
import type { PreparedLeaveDecision } from "@/contexts/leave/infrastructure/adapters/prepare-leave-decision.adapter"
import { LeaveRequestRepository } from "@/contexts/leave/infrastructure/repositories/leave-request.repository"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import { parseD1Row } from "@/lib/d1/parse-d1-row"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"

/** 確認した申請内容、資格、残数、判断、監査を同じtransactionで確定する。 */
export class LeaveDecisionRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async commit(input: PreparedLeaveDecision) {
    try {
      const db = this.c.env.DB
      const before = toLeaveDecisionSnapshot(input.existing)
      const assertions = [
        ...input.assertions,
        db
          .prepare(`SELECT CASE WHEN EXISTS (
        SELECT 1 FROM leave_requests WHERE id = ?1
          AND employee_id IS json_extract(?2, '$.employeeId')
          AND leave_type IS json_extract(?2, '$.leaveType')
          AND start_date IS json_extract(?2, '$.startDate')
          AND end_date IS json_extract(?2, '$.endDate')
          AND days IS json_extract(?2, '$.days')
          AND unit IS json_extract(?2, '$.unit')
          AND hours IS json_extract(?2, '$.hours')
          AND consumed_days IS json_extract(?2, '$.consumedDays')
          AND reason IS json_extract(?2, '$.reason')
          AND status = 'pending'
          AND approver_id IS json_extract(?2, '$.approverId')
          AND decided_comment IS json_extract(?2, '$.decidedComment')
          AND created_at IS json_extract(?2, '$.createdAt')
      ) THEN 1 ELSE json_extract('{}', 'leave_request_changed') END AS ok`)
          .bind(input.existing.id, JSON.stringify(before)),
      ]
      const balance = this.prepareBalance(input)
      const decision = db
        .prepare(`UPDATE leave_requests
      SET status = ?2, approver_id = ?3, decided_comment = ?4
      WHERE id = ?1 AND status = 'pending'
      RETURNING id, employee_id AS employeeId, leave_type AS leaveType,
        start_date AS startDate, end_date AS endDate, days, unit, hours,
        consumed_days AS consumedDays, reason, status, approver_id AS approverId,
        decided_comment AS decidedComment, created_at AS createdAt`)
        .bind(input.existing.id, input.status, input.approverId, input.comment)
      const statements = [
        ...assertions,
        ...balance,
        decision,
        db.prepare(`SELECT CASE WHEN changes() = 1 THEN 1
        ELSE json_extract('{}', 'leave_request_changed') END AS ok`),
        ...input.audit,
        ...input.notification,
      ]
      const committed = await db.batch(statements)
      if (committed.length !== statements.length || committed.some((entry) => !entry.success))
        return new UnexpectedError("leave decision batch did not succeed")
      const row = parseD1Row(
        committed.at(assertions.length + balance.length),
        leaveRequestRowSchema,
      )
      if (row instanceof Error || row === undefined)
        return new UnexpectedError("cannot read committed leave decision", { cause: row })
      return LeaveRequest.fromRow(row)
    } catch (cause) {
      if (SystemHumanOperationAuthorizationAdapter.rejected(cause))
        return new ForbiddenError("human authorization changed", "forbidden")
      if (this.rejected(cause, "leave_balance_not_found"))
        return new ConflictError("leave balance record not found", "balance_not_found")
      if (this.rejected(cause, "leave_balance_insufficient"))
        return new ConflictError("insufficient leave balance", "insufficient_balance")
      if (this.rejected(cause, "leave_request_changed")) {
        const current = await new LeaveRequestRepository(this.c).findById(input.existing.id ?? 0)
        if (current === null || (current instanceof LeaveRequest && current.status !== "pending"))
          return new ConflictError("the leave request is already decided", "already_decided")
        return new ConflictError(
          "the leave request changed; review it again",
          "leave_request_changed",
        )
      }
      return new UnexpectedError("failed to commit leave decision", { cause })
    }
  }

  private prepareBalance(input: PreparedLeaveDecision): ReadonlyArray<D1PreparedStatement> {
    if (input.fiscalYear === null) return []
    const db = this.c.env.DB
    const parameters = [input.existing.employeeId, input.existing.leaveType, input.fiscalYear]
    return [
      db
        .prepare(`SELECT CASE WHEN EXISTS (SELECT 1 FROM leave_balances
        WHERE employee_id = ?1 AND leave_type = ?2 AND fiscal_year = ?3)
        THEN 1 ELSE json_extract('{}', 'leave_balance_not_found') END AS ok`)
        .bind(...parameters),
      db
        .prepare(`UPDATE leave_balances SET used_days = used_days + ?4,
        remaining_days = remaining_days - ?4
        WHERE employee_id = ?1 AND leave_type = ?2 AND fiscal_year = ?3
          AND remaining_days >= ?4`)
        .bind(...parameters, input.existing.consumedDays),
      db.prepare(`SELECT CASE WHEN changes() = 1 THEN 1
        ELSE json_extract('{}', 'leave_balance_insufficient') END AS ok`),
    ]
  }

  private rejected(cause: unknown, code: string): boolean {
    const visited = new Set<Error>()
    for (let error = cause; error instanceof Error && !visited.has(error); error = error.cause) {
      if (
        error.message.includes(`'${code}'`) &&
        /bad JSON path:|JSON path error near/i.test(error.message)
      )
        return true
      visited.add(error)
    }
    return false
  }
}
