import { z } from "zod"
import type { AttachmentEvidence } from "@system/domain/definitions/attachments/attachment-evidence.definition"
import { PrepareAttachmentEvidenceAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-evidence.adapter"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { NotificationMessageEntity } from "@system/domain/entities/notification-message.entity"
import { NotificationDeliveryEntity } from "@system/domain/entities/notification-delivery.entity"
import { NotificationDeliveryBatchValue } from "@system/domain/values/notifications/notification-delivery-batch.value"
import { SystemNotificationRepository } from "@system/infrastructure/repositories/notifications/system-notification.repository"
import { Expense } from "@/contexts/expense/domain/entities/expense.entity"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import { expenses } from "@/contexts/expense/infrastructure/schema/expense"
import {
  expenseProcedureBindingSchema,
  type ExpenseProcedureBinding,
} from "@/contexts/expense/domain/definitions/expense-procedure.definition"
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

export class ExpenseProcedureRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async cancelProcedure(
    input: Readonly<{
      binding: ExpenseProcedureBinding
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
        SELECT 1 FROM expense_procedure_bindings binding
        JOIN system_decision_tasks task ON task.case_id = binding.case_id
        WHERE binding.expense_id = ?1 AND binding.case_id = ?2 AND binding.proposal_digest = ?3
          AND task.task_key = ?4 AND task.round = ?5 AND task.outcome IS NULL
      ) THEN 1 ELSE abs(-9223372036854775808) END`).bind(
          input.binding.expenseId,
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
      binding: ExpenseProcedureBinding
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
      return new Error("expense decision receipt unavailable", { cause })
    }
  }

  async recordDecision(
    input: Readonly<{
      binding: ExpenseProcedureBinding
      attestation: HumanAttestationEntity
      nextTask: SystemDecisionTaskBundle | null
      guards: ReadonlyArray<D1PreparedStatement>
      audit: SystemAuditEventEntity
    }>,
  ) {
    const notification = await this.prepareNotification(
      input.binding,
      input.attestation.decidedAt,
      "経費への判断が記録されました",
    )
    if (notification instanceof Error) return notification
    const database = this.c.env.DB
    return new SystemD1WorkflowAdapter({
      ...this.c,
      decisionGuards: [
        ...input.guards,
        database
          .prepare(`SELECT CASE WHEN EXISTS (
          SELECT 1 FROM expense_procedure_bindings binding JOIN expenses request ON request.id = binding.expense_id
          WHERE binding.expense_id = ?1 AND binding.case_id = ?2 AND binding.proposal_digest = ?3
            AND request.status = 'pending'
        ) THEN 1 ELSE abs(-9223372036854775808) END`)
          .bind(
            input.binding.expenseId,
            input.attestation.caseId,
            input.attestation.proposalDigest,
          ),
      ],
      decisionEffects: [
        database
          .prepare(`UPDATE expenses SET status = 'rejected'
          WHERE id = ?1 AND status = 'pending' AND EXISTS (
            SELECT 1 FROM system_cases WHERE id = ?2 AND status = 'rejected'
          )`)
          .bind(input.binding.expenseId, input.attestation.caseId),
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
      expenseId: number | null
      previousExpenseId?: number | null
      existingExpenseId?: number | null
      actorAccountId: string
      guards: ReadonlyArray<D1PreparedStatement>
    }>,
  ): Promise<boolean | Error> {
    try {
      const receipt = await this.c.env.DB.batch<{ found: number }>([
        ...input.guards,
        this.c.env.DB.prepare(`SELECT 1 AS found FROM expense_procedure_bindings binding
          JOIN system_proposal_series series ON series.id = binding.series_id
          WHERE binding.expense_id = ?1 AND series.created_by_account_id = ?2
            AND binding.previous_expense_id IS ?3 AND (?4 IS NULL OR binding.expense_id = ?4)`).bind(
          input.expenseId,
          input.actorAccountId,
          input.previousExpenseId ?? null,
          input.existingExpenseId ?? null,
        ),
      ])
      return receipt.at(-1)?.results.at(0)?.found === 1
    } catch (cause) {
      return new Error("expense submission receipt authorization changed", { cause })
    }
  }

  async readExecutionReceipt(
    input: Readonly<{
      binding: ExpenseProcedureBinding
      actorAccountId: string
      guards: ReadonlyArray<D1PreparedStatement>
    }>,
  ): Promise<boolean | Error> {
    try {
      const saved = await this.c.env.DB.batch<{ found: number }>([
        ...input.guards,
        this.c.env.DB.prepare(`SELECT 1 AS found FROM system_execution_authorizations
          WHERE case_id = ?1 AND operation_key = 'expense.request.authorize'
            AND proposal_digest = ?2 AND granted_to_account_id = ?3 AND used_at IS NOT NULL`).bind(
          input.binding.caseId,
          input.binding.proposalDigest,
          input.actorAccountId,
        ),
      ])
      return saved.at(-1)?.results.at(0)?.found === 1
    } catch (cause) {
      return new Error("expense execution receipt authorization changed", { cause })
    }
  }

  async findByRequestKey(requestKey: string): Promise<Expense | null | Error> {
    try {
      const id = await this.c.env.DB.prepare(
        "SELECT expense_id FROM expense_procedure_bindings WHERE request_key = ?1",
      )
        .bind(requestKey)
        .first<number>("expense_id")
      return id === null ? null : this.findById(id)
    } catch (cause) {
      return new Error("failed to read expense submission receipt", { cause })
    }
  }

  async findProcedure(expenseId: number): Promise<ExpenseProcedureBinding | null | Error> {
    try {
      const row =
        await this.c.env.DB.prepare(`SELECT previous_expense_id AS previousExpenseId, request_key AS requestKey,
        expense_id AS expenseId, application_id AS applicationId, series_id AS seriesId,
        case_id AS caseId, proposal_digest AS proposalDigest, created_at AS createdAt, attachment_evidence_json AS attachmentEvidenceJson
        FROM expense_procedure_bindings WHERE expense_id = ?1`)
          .bind(expenseId)
          .first()
      if (row === null) return null
      const attachmentRow = z
        .object({ attachmentEvidenceJson: z.string() })
        .passthrough()
        .parse(row)
      const parsed = expenseProcedureBindingSchema.safeParse({
        ...attachmentRow,
        attachments: JSON.parse(attachmentRow.attachmentEvidenceJson),
      })
      return parsed.success
        ? parsed.data
        : new Error("invalid expense procedure binding", { cause: parsed.error })
    } catch (cause) {
      return new Error("failed to load expense procedure", { cause })
    }
  }

  async createWithProcedure(
    input: Readonly<{
      requestKey: string
      existingExpenseId?: number | null
      previousExpenseId?: number | null
      expense: Expense
      attachments: ReadonlyArray<AttachmentEvidence>
      attachmentEffects: ReadonlyArray<D1PreparedStatement>
      workflow: Parameters<SystemWorkflowWriter["start"]>[0]
      guards: ReadonlyArray<D1PreparedStatement>
      audit: SystemAuditEventEntity
    }>,
  ): Promise<Expense | Error> {
    const database = this.c.env.DB
    const evidence = CanonicalSystemJsonValue.create(input.attachments)
    if (evidence instanceof Error) return evidence
    const system = new SystemD1WorkflowAdapter({ ...this.c, startGuards: input.guards })
    const statements = system.prepareStartStatements(input.workflow)
    try {
      const saved = await database.batch<{ id: number }>([
        ...statements.slice(0, -1),
        ...input.attachmentEffects,
        ...(input.existingExpenseId == null
          ? [
              database
                .prepare(`INSERT INTO expenses
          (employee_id, organization_unit_id, category, amount, spent_at, note, status, created_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?7)`)
                .bind(
                  input.expense.employeeId,
                  input.expense.organizationUnitId,
                  input.expense.category,
                  input.expense.amount,
                  input.expense.spentAt,
                  input.expense.note,
                  input.expense.createdAt,
                ),
              abortWhenPreviousStatementChangedNoRows(database),
            ]
          : []),
        database
          .prepare(`INSERT INTO expense_procedure_bindings
          (request_key, expense_id, application_id, series_id, case_id, proposal_digest, created_at, previous_expense_id, attachment_evidence_json)
          VALUES (?1, coalesce(?6, last_insert_rowid()),
            (SELECT number FROM system_proposal_numbers WHERE series_id = ?2), ?2, ?3, ?4, ?5, ?7, ?8)`)
          .bind(
            input.requestKey,
            input.workflow.proposal.seriesId,
            input.workflow.workflowCase.id,
            input.workflow.proposal.digest,
            input.workflow.proposal.createdAt.getTime(),
            input.existingExpenseId ?? null,
            input.previousExpenseId ?? null,
            evidence.toString(),
          ),
        abortWhenPreviousStatementChangedNoRows(database),
        ...(input.existingExpenseId == null
          ? input.attachments.map((attachment) =>
              database
                .prepare(`INSERT INTO expense_attachments
          (expense_id, attachment_id, created_at) VALUES ((SELECT expense_id FROM expense_procedure_bindings WHERE request_key = ?1), ?2, ?3)`)
                .bind(input.requestKey, attachment.id, input.expense.createdAt),
            )
          : []),
        database
          .prepare(`SELECT CASE WHEN (SELECT count(*) FROM expense_attachments WHERE expense_id =
          (SELECT expense_id FROM expense_procedure_bindings WHERE request_key = ?1)) = ?2
          AND NOT EXISTS (
            SELECT 1 FROM expense_attachments link
            JOIN expense_procedure_bindings binding ON binding.expense_id = link.expense_id
            WHERE binding.request_key = ?1 AND NOT EXISTS (
              SELECT 1 FROM json_each(?3) expected WHERE expected.value = link.attachment_id
            )
          )
          THEN 1 ELSE abs(-9223372036854775808) END`)
          .bind(
            input.requestKey,
            input.attachments.length,
            JSON.stringify(input.attachments.map((attachment) => attachment.id)),
          ),
        ...new SystemAuditEventRepository(this.c).prepareAppend(input.audit),
        database
          .prepare("SELECT expense_id AS id FROM expense_procedure_bindings WHERE request_key = ?1")
          .bind(input.requestKey),
      ])
      const id = saved.at(-1)?.results.at(0)?.id
      if (id === undefined) return new Error("expense procedure was not saved")
      const expense = await this.findById(id)
      return expense ?? new Error("saved expense request is missing")
    } catch (cause) {
      return new Error("failed to create expense procedure", { cause })
    }
  }

  async executeAuthorized(
    input: Readonly<{
      binding: ExpenseProcedureBinding
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
      "経費が決裁されました",
    )
    if (notification instanceof Error) return notification
    const database = this.c.env.DB
    if (
      input.authorization.caseId !== input.binding.caseId ||
      input.authorization.proposalDigest !== input.binding.proposalDigest ||
      input.authorization.operationKey !== "expense.request.authorize"
    )
      return new Error("expense execution authorization does not match")
    return new SystemD1AuthorizedExecutionAdapter(this.c).execute({
      authorization: input.authorization,
      proposalDigest: input.authorization.proposalDigest,
      executedAt: input.decidedAt,
      operationStatements: [
        ...input.guards,
        database
          .prepare(`UPDATE expenses SET status = 'approved' WHERE id = ?1 AND status = 'pending'
            AND EXISTS (SELECT 1 FROM expense_procedure_bindings binding
              WHERE binding.expense_id = expenses.id AND binding.case_id = ?2
                AND binding.series_id = ?3 AND binding.proposal_digest = ?4
                AND binding.request_key = ?5)`)
          .bind(
            input.binding.expenseId,
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
    binding: ExpenseProcedureBinding,
    at: Date,
    title: string,
  ): Promise<ReadonlyArray<D1PreparedStatement> | Error> {
    try {
      const recipient = await this.c.env.DB.prepare(`SELECT series.created_by_account_id
        FROM expense_procedure_bindings binding JOIN system_proposal_series series ON series.id = binding.series_id
        WHERE binding.expense_id = ?1 AND binding.case_id = ?2 AND binding.proposal_digest = ?3`)
        .bind(binding.expenseId, binding.caseId, binding.proposalDigest)
        .first<string>("created_by_account_id")
      if (recipient === null) return new Error("expense notification recipient is missing")
      const words = crypto.getRandomValues(new Uint32Array(2))
      const id = String(((words[0] ?? 0) & 0x000f_ffff) * 0x1_0000_0000 + (words[1] ?? 0) || 1)
      const message = NotificationMessageEntity.create({
        id,
        kind: "company:approval_result",
        title,
        body: null,
        source: {
          type: "company:notification.source",
          id: JSON.stringify({ domain: "expense", id: binding.expenseId }),
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
      return new Error("expense notification cannot be prepared", { cause })
    }
  }

  async findById(expenseId: number): Promise<Expense | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(expenses)
        .where(eq(expenses.id, expenseId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Expense.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load expense request")
    }
  }

  async readAttachmentIds(expenseId: number): Promise<ReadonlyArray<string> | Error> {
    try {
      const rows = await this.c.env.DB.prepare(
        "SELECT attachment_id FROM expense_attachments WHERE expense_id = ?1 ORDER BY attachment_id",
      )
        .bind(expenseId)
        .all<{ attachment_id: string }>()
      return rows.results.map((row) => row.attachment_id)
    } catch (cause) {
      return new Error("expense attachments unavailable", { cause })
    }
  }

  async prepareEvidence(binding: ExpenseProcedureBinding, at: Date) {
    try {
      const owner = await this.c.env.DB.prepare(
        "SELECT created_by_account_id FROM system_proposal_series WHERE id = ?1",
      )
        .bind(binding.seriesId)
        .first<string>("created_by_account_id")
      if (owner === null) return new Error("expense evidence owner missing")
      const ids = binding.attachments.map((attachment) => attachment.id)
      const prepared = await new PrepareAttachmentEvidenceAdapter(this.c).prepare({
        attachmentIds: ids,
        ownerAccountId: owner,
        linkedAttachmentIds: new Set(ids),
        expected: binding.attachments,
        at,
      })
      if (prepared instanceof Error) return prepared
      return [
        ...prepared.guards,
        this.c.env.DB.prepare(`SELECT CASE WHEN
        (SELECT count(*) FROM expense_attachments WHERE expense_id = ?1) = json_array_length(?2)
        AND NOT EXISTS (SELECT 1 FROM expense_attachments link WHERE link.expense_id = ?1
          AND NOT EXISTS (SELECT 1 FROM json_each(?2) expected WHERE expected.value = link.attachment_id))
        THEN 1 ELSE abs(-9223372036854775808) END`).bind(binding.expenseId, JSON.stringify(ids)),
      ]
    } catch (cause) {
      return new Error("expense evidence cannot be verified", { cause })
    }
  }
}
