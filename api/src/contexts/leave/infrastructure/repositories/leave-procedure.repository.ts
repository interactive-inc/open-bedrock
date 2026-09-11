import type { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import { SystemD1AuthorizedExecutionAdapter } from "@system/infrastructure/adapters/workflow/system-d1-authorized-execution.adapter"
import type { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { HumanAttestationEntity } from "@system/domain/entities/human-attestation.entity"
import type { SystemDecisionTaskBundle } from "@system/domain/definitions/workflow/system-decision-task-bundle.definition"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { Context } from "@/env"
import {
  leaveProcedureBindingSchema,
  type LeaveProcedureBinding,
} from "@/contexts/leave/domain/definitions/leave-procedure.definition"
import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import {
  SystemD1WorkflowAdapter,
  type SystemWorkflowWriter,
} from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"

/** 休暇の提出とSystem案件を同じtransactionへ保存する。 */
export class LeaveProcedureRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async cancelProcedure(
    input: Readonly<{
      binding: LeaveProcedureBinding
      actorAccountId: AccountId
      taskKey: string
      taskRound: number
      cancelledAt: Date
      guards: ReadonlyArray<D1PreparedStatement>
      audit: SystemAuditEventEntity
    }>,
  ) {
    return new SystemD1WorkflowAdapter({
      ...this.c,
      cancelGuards: [
        ...input.guards,
        this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
        SELECT 1 FROM leave_procedure_bindings binding
        JOIN system_decision_tasks task ON task.case_id = binding.case_id
        WHERE binding.leave_request_id = ?1 AND binding.case_id = ?2 AND binding.proposal_digest = ?3
          AND task.task_key = ?4 AND task.round = ?5 AND task.outcome IS NULL
      ) THEN 1 ELSE abs(-9223372036854775808) END`).bind(
          input.binding.leaveRequestId,
          input.binding.caseId,
          input.binding.proposalDigest,
          input.taskKey,
          input.taskRound,
        ),
      ],
      cancelEffects: new SystemAuditEventRepository(this.c).prepareAppend(input.audit),
    }).cancel({
      number: input.binding.applicationId,
      createdByAccountId: input.actorAccountId,
      cancelledAt: input.cancelledAt,
    })
  }

  async findDraftSource(leaveRequestId: number): Promise<number | null> {
    return this.c.env.DB.prepare(
      "SELECT previous_leave_request_id FROM leave_requests WHERE id = ?1",
    )
      .bind(leaveRequestId)
      .first<number>("previous_leave_request_id")
  }

  async findForRequest(leaveRequestId: number): Promise<LeaveProcedureBinding | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(`SELECT request_key AS requestKey,
        leave_request_id AS leaveRequestId, previous_leave_request_id AS previousLeaveRequestId,
        application_id AS applicationId, series_id AS seriesId, case_id AS caseId,
        proposal_digest AS proposalDigest, created_at AS createdAt
        FROM leave_procedure_bindings WHERE leave_request_id = ?1`)
        .bind(leaveRequestId)
        .first()
      if (row === null) return null
      const parsed = leaveProcedureBindingSchema.safeParse(row)
      return parsed.success
        ? parsed.data
        : new Error("invalid leave procedure binding", { cause: parsed.error })
    } catch (cause) {
      return new Error("leave procedure unavailable", { cause })
    }
  }

  async readSubmissionReceipt(
    input: Readonly<{
      binding: LeaveProcedureBinding
      actorAccountId: string
      guards: ReadonlyArray<D1PreparedStatement>
    }>,
  ): Promise<boolean | Error> {
    try {
      const receipt = await this.c.env.DB.batch<{ found: number }>([
        ...input.guards,
        this.c.env.DB.prepare(`SELECT 1 AS found FROM leave_procedure_bindings binding
          JOIN system_proposal_series series ON series.id = binding.series_id
          WHERE binding.request_key = ?1 AND binding.leave_request_id = ?2
            AND series.created_by_account_id = ?3 AND binding.proposal_digest = ?4
            AND binding.previous_leave_request_id IS ?5`).bind(
          input.binding.requestKey,
          input.binding.leaveRequestId,
          input.actorAccountId,
          input.binding.proposalDigest,
          input.binding.previousLeaveRequestId,
        ),
      ])
      if (receipt.some((entry) => !entry.success)) return new Error("leave receipt guard failed")
      return receipt.at(-1)?.results.at(0)?.found === 1
    } catch (cause) {
      return new Error("leave receipt authorization changed", { cause })
    }
  }

  async submit(
    input: Readonly<{
      leaveRequestId: number
      previousLeaveRequestId: number | null
      requestKey: string
      workflow: Parameters<SystemWorkflowWriter["start"]>[0]
      guards: ReadonlyArray<D1PreparedStatement>
      audit: SystemAuditEventEntity
    }>,
  ): Promise<LeaveProcedureBinding | Error> {
    const database = this.c.env.DB
    const system = new SystemD1WorkflowAdapter({ ...this.c, startGuards: input.guards })
    try {
      const saved = await database.batch([
        ...system.prepareStartStatements(input.workflow),
        database
          .prepare(`INSERT INTO leave_procedure_bindings
          (request_key, leave_request_id, previous_leave_request_id, application_id,
           series_id, case_id, proposal_digest, created_at)
          VALUES (?1, ?2, ?3, (SELECT number FROM system_proposal_numbers WHERE series_id = ?4),
            ?4, ?5, ?6, ?7)`)
          .bind(
            input.requestKey,
            input.leaveRequestId,
            input.previousLeaveRequestId,
            input.workflow.proposal.seriesId,
            input.workflow.workflowCase.id,
            input.workflow.proposal.digest,
            input.workflow.proposal.createdAt.getTime(),
          ),
        abortWhenPreviousStatementChangedNoRows(database),
        ...new SystemAuditEventRepository(this.c).prepareAppend(input.audit),
      ])
      if (saved.some((entry) => !entry.success)) return new Error("leave submission batch failed")
      const binding = await this.findForRequest(input.leaveRequestId)
      return binding ?? new Error("saved leave procedure is missing")
    } catch (cause) {
      return new Error("leave submission failed", { cause })
    }
  }
  async findDecisionReceipt(
    input: Readonly<{
      binding: LeaveProcedureBinding
      actorAccountId: AccountId
      decisionTarget: Readonly<{
        proposalVersion: number
        proposalDigest: string
        taskKey: string
        taskRound: number
      }>
      action: "approve" | "reject"
      comment: string | null
      guards: ReadonlyArray<D1PreparedStatement>
    }>,
  ): Promise<"matching" | "different" | null | Error> {
    try {
      const saved = await this.c.env.DB.batch<{ action: string; comment: string | null }>([
        ...input.guards,
        this.c.env.DB.prepare(`SELECT attestation.action, attestation.comment
          FROM system_human_attestations attestation
          JOIN system_proposal_cases link ON link.case_id = attestation.case_id
          JOIN system_proposals proposal ON proposal.id = link.proposal_id
          WHERE attestation.case_id = ?1 AND attestation.actor_account_id = ?2
            AND attestation.task_key = ?3 AND attestation.round = ?4
            AND attestation.proposal_digest = ?5 AND proposal.version = ?6`).bind(
          input.binding.caseId,
          input.actorAccountId,
          input.decisionTarget.taskKey,
          input.decisionTarget.taskRound,
          input.decisionTarget.proposalDigest,
          input.decisionTarget.proposalVersion,
        ),
      ])
      const row = saved.at(-1)?.results.at(0)
      if (row === undefined) return null
      return (row.action === input.action ||
        (input.action === "reject" && row.action === "return")) &&
        row.comment === input.comment
        ? "matching"
        : "different"
    } catch (cause) {
      return new Error("leave decision receipt unavailable", { cause })
    }
  }

  async recordDecision(
    input: Readonly<{
      binding: LeaveProcedureBinding
      attestation: HumanAttestationEntity
      nextTask: SystemDecisionTaskBundle | null
      guards: ReadonlyArray<D1PreparedStatement>
      audit: SystemAuditEventEntity
    }>,
  ) {
    const database = this.c.env.DB
    return new SystemD1WorkflowAdapter({
      ...this.c,
      decisionGuards: [
        ...input.guards,
        database
          .prepare(`SELECT CASE WHEN EXISTS (
          SELECT 1 FROM leave_procedure_bindings binding JOIN leave_requests request ON request.id = binding.leave_request_id
          WHERE binding.leave_request_id = ?1 AND binding.case_id = ?2 AND binding.proposal_digest = ?3
            AND request.status = 'pending'
        ) THEN 1 ELSE abs(-9223372036854775808) END`)
          .bind(
            input.binding.leaveRequestId,
            input.attestation.caseId,
            input.attestation.proposalDigest,
          ),
      ],
      decisionEffects: new SystemAuditEventRepository(this.c).prepareAppend(input.audit),
    }).decide({
      attestation: input.attestation,
      decidedAt: input.attestation.decidedAt,
      nextTask: input.nextTask,
    })
  }
  async readRejectionEvidence(
    input: Readonly<{
      binding: LeaveProcedureBinding
      actorAccountId: AccountId
      guards: ReadonlyArray<D1PreparedStatement>
    }>,
  ): Promise<Readonly<{ id: string; comment: string | null }> | null | Error> {
    try {
      const result = await this.c.env.DB.batch<{ id: string; comment: string | null }>([
        ...input.guards,
        this.c.env.DB.prepare(`SELECT attestation.id, attestation.comment
          FROM system_human_attestations attestation
          JOIN system_decision_tasks task ON task.case_id = attestation.case_id
            AND task.task_key = attestation.task_key AND task.round = attestation.round
          JOIN system_cases workflow_case ON workflow_case.id = task.case_id
          WHERE attestation.case_id = ?1 AND attestation.proposal_digest = ?2
            AND attestation.actor_account_id = ?3 AND attestation.action = 'reject'
            AND task.outcome = 'rejected' AND workflow_case.status = 'rejected'
          ORDER BY attestation.decided_at DESC, attestation.id LIMIT 1`).bind(
          input.binding.caseId,
          input.binding.proposalDigest,
          input.actorAccountId,
        ),
      ])
      if (result.some((entry) => !entry.success)) return new Error("leave rejection guard failed")
      return result.at(-1)?.results.at(0) ?? null
    } catch (cause) {
      return new Error("leave rejection evidence unavailable", { cause })
    }
  }

  async completeRejection(
    input: Readonly<{
      binding: LeaveProcedureBinding
      attestationId: string
      approverId: EmployeeId
      guards: ReadonlyArray<D1PreparedStatement>
      audit: SystemAuditEventEntity
      notification: ReadonlyArray<D1PreparedStatement>
    }>,
  ): Promise<true | Error> {
    const database = this.c.env.DB
    try {
      const result = await database.batch([
        ...input.guards,
        database
          .prepare(`UPDATE leave_requests SET status = 'rejected', approver_id = ?2,
          decided_comment = (SELECT comment FROM system_human_attestations WHERE id = ?3)
          WHERE id = ?1 AND status = 'pending' AND EXISTS (
            SELECT 1 FROM leave_procedure_bindings binding
            JOIN system_cases workflow_case ON workflow_case.id = binding.case_id
            JOIN system_human_attestations attestation ON attestation.case_id = binding.case_id
            JOIN system_decision_tasks task ON task.case_id = attestation.case_id
              AND task.task_key = attestation.task_key AND task.round = attestation.round
            WHERE binding.leave_request_id = leave_requests.id AND binding.case_id = ?4
              AND binding.series_id = ?5 AND binding.proposal_digest = ?6
              AND binding.request_key = ?7 AND workflow_case.status = 'rejected'
              AND task.outcome = 'rejected' AND attestation.id = ?3
              AND attestation.action = 'reject' AND attestation.proposal_digest = ?6
              AND attestation.actor_account_id = ?8
          )`)
          .bind(
            input.binding.leaveRequestId,
            input.approverId,
            input.attestationId,
            input.binding.caseId,
            input.binding.seriesId,
            input.binding.proposalDigest,
            input.binding.requestKey,
            input.audit.actorAccountId,
          ),
        abortWhenPreviousStatementChangedNoRows(database),
        ...new SystemAuditEventRepository(this.c).prepareAppend(input.audit),
        ...input.notification,
      ])
      return result.every((entry) => entry.success)
        ? true
        : new Error("leave rejection batch failed")
    } catch (cause) {
      return new Error("leave rejection completion failed", { cause })
    }
  }

  async readExecutionReceipt(
    input: Readonly<{
      binding: LeaveProcedureBinding
      actorAccountId: string
      guards: ReadonlyArray<D1PreparedStatement>
    }>,
  ): Promise<boolean | Error> {
    try {
      const saved = await this.c.env.DB.batch<{ found: number }>([
        ...input.guards,
        this.c.env.DB.prepare(`SELECT 1 AS found FROM system_execution_authorizations
          WHERE case_id = ?1 AND operation_key = 'leave.request.authorize'
            AND proposal_digest = ?2 AND granted_to_account_id = ?3 AND used_at IS NOT NULL`).bind(
          input.binding.caseId,
          input.binding.proposalDigest,
          input.actorAccountId,
        ),
      ])
      return saved.at(-1)?.results.at(0)?.found === 1
    } catch (cause) {
      return new Error("leave execution receipt authorization changed", { cause })
    }
  }

  async executeAuthorized(
    input: Readonly<{
      binding: LeaveProcedureBinding
      authorization: ExecutionAuthorizationEntity
      guards: ReadonlyArray<D1PreparedStatement>
      audit: SystemAuditEventEntity
      request: LeaveRequest
      approverId: EmployeeId
      fiscalYear: string | null
      notification: ReadonlyArray<D1PreparedStatement>
    }>,
  ): Promise<true | Error> {
    if (
      input.authorization.caseId !== input.binding.caseId ||
      input.authorization.proposalDigest !== input.binding.proposalDigest ||
      input.authorization.operationKey !== "leave.request.authorize" ||
      input.request.id !== input.binding.leaveRequestId
    )
      return new Error("leave execution target mismatch")
    const database = this.c.env.DB
    const balance =
      input.fiscalYear === null
        ? []
        : [
            database
              .prepare(`UPDATE leave_balances SET used_days = used_days + ?4,
        remaining_days = remaining_days - ?4
        WHERE employee_id = ?1 AND leave_type = ?2 AND fiscal_year = ?3 AND remaining_days >= ?4`)
              .bind(
                input.request.employeeId,
                input.request.leaveType,
                input.fiscalYear,
                input.request.consumedDays,
              ),
            abortWhenPreviousStatementChangedNoRows(database),
          ]
    return new SystemD1AuthorizedExecutionAdapter(this.c).execute({
      authorization: input.authorization,
      proposalDigest: input.authorization.proposalDigest,
      executedAt: input.authorization.grantedAt,
      operationStatements: [
        ...input.guards,
        ...balance,
        database
          .prepare(`UPDATE leave_requests SET status = 'approved', approver_id = ?2, decided_comment = NULL
          WHERE id = ?1 AND status = 'pending' AND EXISTS (
            SELECT 1 FROM leave_procedure_bindings binding
            WHERE binding.leave_request_id = leave_requests.id AND binding.case_id = ?3
              AND binding.series_id = ?4 AND binding.proposal_digest = ?5 AND binding.request_key = ?6
          )`)
          .bind(
            input.binding.leaveRequestId,
            input.approverId,
            input.binding.caseId,
            input.binding.seriesId,
            input.binding.proposalDigest,
            input.binding.requestKey,
          ),
        abortWhenPreviousStatementChangedNoRows(database),
        ...new SystemAuditEventRepository(this.c).prepareAppend(input.audit),
        ...input.notification,
      ],
    })
  }
}
