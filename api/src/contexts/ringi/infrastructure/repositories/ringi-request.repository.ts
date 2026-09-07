import { NotificationMessageEntity } from "@system/domain/entities/notification-message.entity"
import { NotificationDeliveryEntity } from "@system/domain/entities/notification-delivery.entity"
import { NotificationDeliveryBatchValue } from "@system/domain/values/notifications/notification-delivery-batch.value"
import { SystemNotificationRepository } from "@system/infrastructure/repositories/notifications/system-notification.repository"
import { RingiRequest } from "@/contexts/ringi/domain/entities/ringi-request.entity"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import { ringiRequests } from "@/contexts/ringi/infrastructure/schema/ringi"
import {
  ringiProcedureBindingSchema,
  type RingiProcedureBinding,
} from "@/contexts/ringi/domain/definitions/ringi-procedure.definition"
import type { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import type { HumanAttestationEntity } from "@system/domain/entities/human-attestation.entity"
import type { SystemDecisionTaskBundle } from "@system/domain/definitions/workflow/system-decision-task-bundle.definition"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import {
  SystemD1WorkflowAdapter,
  type SystemWorkflowWriter,
} from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { SystemD1AuthorizedExecutionAdapter } from "@system/infrastructure/adapters/workflow/system-d1-authorized-execution.adapter"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { eq } from "drizzle-orm"

type Context = CompanyContext

export class RingiRequestRepository {
  constructor(private readonly c: Context) {}

  async cancelProcedure(
    input: Readonly<{
      binding: RingiProcedureBinding
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
        SELECT 1 FROM ringi_procedure_bindings binding
        JOIN system_decision_tasks task ON task.case_id = binding.case_id
        WHERE binding.ringi_id = ?1 AND binding.case_id = ?2 AND binding.proposal_digest = ?3
          AND task.task_key = ?4 AND task.round = ?5 AND task.outcome IS NULL
      ) THEN 1 ELSE abs(-9223372036854775808) END`).bind(
          input.binding.ringiId,
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

  async findDecisionReceipt(
    input: Readonly<{
      binding: RingiProcedureBinding
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
      return new Error("ringi decision receipt unavailable", { cause })
    }
  }

  async recordDecision(
    input: Readonly<{
      binding: RingiProcedureBinding
      attestation: HumanAttestationEntity
      nextTask: SystemDecisionTaskBundle | null
      guards: ReadonlyArray<D1PreparedStatement>
      audit: SystemAuditEventEntity
    }>,
  ) {
    const notification = await this.prepareNotification(
      input.binding,
      input.attestation.decidedAt,
      "稟議への判断が記録されました",
    )
    if (notification instanceof Error) return notification
    const database = this.c.env.DB
    return new SystemD1WorkflowAdapter({
      ...this.c,
      decisionGuards: [
        ...input.guards,
        database
          .prepare(`SELECT CASE WHEN EXISTS (
          SELECT 1 FROM ringi_procedure_bindings binding JOIN ringi_requests request ON request.id = binding.ringi_id
          WHERE binding.ringi_id = ?1 AND binding.case_id = ?2 AND binding.proposal_digest = ?3
            AND request.status = 'pending'
        ) THEN 1 ELSE abs(-9223372036854775808) END`)
          .bind(input.binding.ringiId, input.attestation.caseId, input.attestation.proposalDigest),
      ],
      decisionEffects: [
        database
          .prepare(`UPDATE ringi_requests SET status = 'rejected', decided_at = ?2, decision_comment = ?3
          WHERE id = ?1 AND status = 'pending' AND EXISTS (
            SELECT 1 FROM system_cases WHERE id = ?4 AND status = 'rejected'
          )`)
          .bind(
            input.binding.ringiId,
            input.attestation.decidedAt.toISOString(),
            input.attestation.comment,
            input.attestation.caseId,
          ),
        ...new SystemAuditEventRepository(this.c).prepareAppend(input.audit),
        ...notification,
      ],
    }).decide({
      attestation: input.attestation,
      decidedAt: input.attestation.decidedAt,
      nextTask: input.nextTask,
    })
  }

  async prepareSubmissionGuard(accountId: AccountId): Promise<D1PreparedStatement | Error> {
    return new CompanyAuthoritySnapshotGuardAdapter({ database: this.c.env.DB }).prepare({
      accountIds: [accountId],
      employeeCodes: [],
    })
  }

  async readSubmissionReceipt(
    input: Readonly<{
      ringiId: number | null
      previousRingiId?: number | null
      existingRingiId?: number | null
      actorAccountId: string
      guards: ReadonlyArray<D1PreparedStatement>
    }>,
  ): Promise<boolean | Error> {
    try {
      const receipt = await this.c.env.DB.batch<{ found: number }>([
        ...input.guards,
        this.c.env.DB.prepare(`SELECT 1 AS found FROM ringi_procedure_bindings binding
          JOIN system_proposal_series series ON series.id = binding.series_id
          WHERE binding.ringi_id = ?1 AND series.created_by_account_id = ?2
            AND binding.previous_ringi_id IS ?3 AND (?4 IS NULL OR binding.ringi_id = ?4)`).bind(
          input.ringiId,
          input.actorAccountId,
          input.previousRingiId ?? null,
          input.existingRingiId ?? null,
        ),
      ])
      return receipt.at(-1)?.results.at(0)?.found === 1
    } catch (cause) {
      return new Error("ringi submission receipt authorization changed", { cause })
    }
  }

  async readExecutionReceipt(
    input: Readonly<{
      binding: RingiProcedureBinding
      actorAccountId: string
      guards: ReadonlyArray<D1PreparedStatement>
    }>,
  ): Promise<boolean | Error> {
    try {
      const saved = await this.c.env.DB.batch<{ found: number }>([
        ...input.guards,
        this.c.env.DB.prepare(`SELECT 1 AS found FROM system_execution_authorizations
          WHERE case_id = ?1 AND operation_key = 'ringi.request.authorize'
            AND proposal_digest = ?2 AND granted_to_account_id = ?3 AND used_at IS NOT NULL`).bind(
          input.binding.caseId,
          input.binding.proposalDigest,
          input.actorAccountId,
        ),
      ])
      return saved.at(-1)?.results.at(0)?.found === 1
    } catch (cause) {
      return new Error("ringi execution receipt authorization changed", { cause })
    }
  }

  async findByRequestKey(requestKey: string): Promise<RingiRequest | null | Error> {
    try {
      const id = await this.c.env.DB.prepare(
        "SELECT ringi_id FROM ringi_procedure_bindings WHERE request_key = ?1",
      )
        .bind(requestKey)
        .first<number>("ringi_id")
      return id === null ? null : this.findById(id)
    } catch (cause) {
      return new Error("failed to read ringi submission receipt", { cause })
    }
  }

  async findProcedure(ringiId: number): Promise<RingiProcedureBinding | null | Error> {
    try {
      const row =
        await this.c.env.DB.prepare(`SELECT previous_ringi_id AS previousRingiId, request_key AS requestKey,
        ringi_id AS ringiId, application_id AS applicationId, series_id AS seriesId,
        case_id AS caseId, proposal_digest AS proposalDigest, created_at AS createdAt
        FROM ringi_procedure_bindings WHERE ringi_id = ?1`)
          .bind(ringiId)
          .first()
      if (row === null) return null
      const parsed = ringiProcedureBindingSchema.safeParse(row)
      return parsed.success
        ? parsed.data
        : new Error("invalid ringi procedure binding", { cause: parsed.error })
    } catch (cause) {
      return new Error("failed to load ringi procedure", { cause })
    }
  }

  async createWithProcedure(
    input: Readonly<{
      requestKey: string
      existingRingiId?: number | null
      previousRingiId?: number | null
      ringi: RingiRequest
      workflow: Parameters<SystemWorkflowWriter["start"]>[0]
      guards: ReadonlyArray<D1PreparedStatement>
      audit: SystemAuditEventEntity
    }>,
  ): Promise<RingiRequest | Error> {
    const database = this.c.env.DB
    const system = new SystemD1WorkflowAdapter({ ...this.c, startGuards: input.guards })
    const statements = system.prepareStartStatements(input.workflow)
    try {
      const saved = await database.batch<{ id: number }>([
        ...statements.slice(0, -1),
        ...(input.existingRingiId == null
          ? [
              database
                .prepare(`INSERT INTO ringi_requests
          (applicant_id, approver_id, title, amount, reason, status, created_at)
          VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6)`)
                .bind(
                  input.ringi.applicantId,
                  input.ringi.approverId,
                  input.ringi.title,
                  input.ringi.amount,
                  input.ringi.reason,
                  input.ringi.createdAt,
                ),
              abortWhenPreviousStatementChangedNoRows(database),
            ]
          : []),
        database
          .prepare(`INSERT INTO ringi_procedure_bindings
          (request_key, ringi_id, application_id, series_id, case_id, proposal_digest, created_at, previous_ringi_id)
          VALUES (?1, coalesce(?6, last_insert_rowid()),
            (SELECT number FROM system_proposal_numbers WHERE series_id = ?2), ?2, ?3, ?4, ?5, ?7)`)
          .bind(
            input.requestKey,
            input.workflow.proposal.seriesId,
            input.workflow.workflowCase.id,
            input.workflow.proposal.digest,
            input.workflow.proposal.createdAt.getTime(),
            input.existingRingiId ?? null,
            input.previousRingiId ?? null,
          ),
        abortWhenPreviousStatementChangedNoRows(database),
        ...new SystemAuditEventRepository(this.c).prepareAppend(input.audit),
        database
          .prepare("SELECT ringi_id AS id FROM ringi_procedure_bindings WHERE request_key = ?1")
          .bind(input.requestKey),
      ])
      const id = saved.at(-1)?.results.at(0)?.id
      if (id === undefined) return new Error("ringi procedure was not saved")
      const ringi = await this.findById(id)
      return ringi ?? new Error("saved ringi request is missing")
    } catch (cause) {
      return new Error("failed to create ringi procedure", { cause })
    }
  }

  async executeAuthorized(
    input: Readonly<{
      binding: RingiProcedureBinding
      authorization: ExecutionAuthorizationEntity
      guards: ReadonlyArray<D1PreparedStatement>
      audit: SystemAuditEventEntity
      decidedAt: Date
      comment: string | null
    }>,
  ): Promise<true | Error> {
    const notification = await this.prepareNotification(
      input.binding,
      input.decidedAt,
      "稟議が決裁されました",
    )
    if (notification instanceof Error) return notification
    const database = this.c.env.DB
    if (
      input.authorization.caseId !== input.binding.caseId ||
      input.authorization.proposalDigest !== input.binding.proposalDigest ||
      input.authorization.operationKey !== "ringi.request.authorize"
    )
      return new Error("ringi execution authorization does not match")
    return new SystemD1AuthorizedExecutionAdapter(this.c).execute({
      authorization: input.authorization,
      proposalDigest: input.authorization.proposalDigest,
      executedAt: input.decidedAt,
      operationStatements: [
        ...input.guards,
        database
          .prepare(`UPDATE ringi_requests SET status = 'approved', decided_at = ?2,
          decision_comment = ?3 WHERE id = ?1 AND status = 'pending'
            AND EXISTS (SELECT 1 FROM ringi_procedure_bindings binding
              WHERE binding.ringi_id = ringi_requests.id AND binding.case_id = ?4
                AND binding.series_id = ?5 AND binding.proposal_digest = ?6
                AND binding.request_key = ?7)`)
          .bind(
            input.binding.ringiId,
            input.decidedAt.toISOString(),
            input.comment,
            input.authorization.caseId,
            input.binding.seriesId,
            input.authorization.proposalDigest,
            input.binding.requestKey,
          ),
        abortWhenPreviousStatementChangedNoRows(database),
        ...new SystemAuditEventRepository(this.c).prepareAppend(input.audit),
        ...notification,
      ],
    })
  }

  private async prepareNotification(
    binding: RingiProcedureBinding,
    at: Date,
    title: string,
  ): Promise<ReadonlyArray<D1PreparedStatement> | Error> {
    try {
      const recipient = await this.c.env.DB.prepare(`SELECT series.created_by_account_id
        FROM ringi_procedure_bindings binding JOIN system_proposal_series series ON series.id = binding.series_id
        WHERE binding.ringi_id = ?1 AND binding.case_id = ?2 AND binding.proposal_digest = ?3`)
        .bind(binding.ringiId, binding.caseId, binding.proposalDigest)
        .first<string>("created_by_account_id")
      if (recipient === null) return new Error("ringi notification recipient is missing")
      const words = crypto.getRandomValues(new Uint32Array(2))
      const id = String(((words[0] ?? 0) & 0x000f_ffff) * 0x1_0000_0000 + (words[1] ?? 0) || 1)
      const message = NotificationMessageEntity.create({
        id,
        kind: "company:approval_result",
        title,
        body: null,
        source: {
          type: "company:notification.source",
          id: JSON.stringify({ domain: "ringi", id: binding.ringiId }),
        },
        createdAt: at,
      })
      if (message instanceof Error) return message
      const delivery = NotificationDeliveryEntity.create({
        id,
        messageId: message.id,
        recipientAccountId: recipient,
        deliveredAt: at,
        readAt: null,
      })
      if (delivery instanceof Error) return delivery
      const deliveries = NotificationDeliveryBatchValue.create([delivery])
      if (deliveries instanceof Error) return deliveries
      return new SystemNotificationRepository({ context: this.c }).preparePublish(
        message,
        deliveries,
      )
    } catch (cause) {
      return new Error("ringi notification cannot be prepared", { cause })
    }
  }

  async findById(ringiId: number): Promise<RingiRequest | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(ringiRequests)
        .where(eq(ringiRequests.id, ringiId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : RingiRequest.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load ringi request")
    }
  }

  async create(ringi: RingiRequest): Promise<RingiRequest | Error> {
    try {
      const rows = await this.c.var.database
        .insert(ringiRequests)
        .values({
          applicantId: ringi.applicantId,
          approverId: ringi.approverId,
          title: ringi.title,
          amount: ringi.amount,
          reason: ringi.reason,
          status: ringi.status,
          decidedAt: ringi.decidedAt,
          decisionComment: ringi.decisionComment,
          createdAt: ringi.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert ringi request")
        : RingiRequest.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert ringi request")
    }
  }
}
