import { RingiRequest } from "@/contexts/ringi/domain/entities/ringi-request.entity"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import { ringiRequests } from "@/contexts/ringi/infrastructure/schema/ringi"
import {
  ringiProcedureBindingSchema,
  type RingiProcedureBinding,
} from "@/contexts/ringi/domain/definitions/ringi-procedure.definition"
import type { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import {
  SystemD1WorkflowAdapter,
  type SystemWorkflowWriter,
} from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { SystemD1AuthorizedExecutionAdapter } from "@system/infrastructure/adapters/workflow/system-d1-authorized-execution.adapter"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { and, eq } from "drizzle-orm"

type Context = CompanyContext

export class RingiRequestRepository {
  constructor(private readonly c: Context) {}

  async prepareSubmissionGuard(accountId: AccountId): Promise<D1PreparedStatement | Error> {
    return new CompanyAuthoritySnapshotGuardAdapter({ database: this.c.env.DB }).prepare({
      accountIds: [accountId],
      employeeCodes: [],
    })
  }

  async readSubmissionReceipt(
    input: Readonly<{
      ringiId: number | null
      actorAccountId: string
      guards: ReadonlyArray<D1PreparedStatement>
    }>,
  ): Promise<boolean | Error> {
    try {
      const receipt = await this.c.env.DB.batch<{ found: number }>([
        ...input.guards,
        this.c.env.DB.prepare(`SELECT 1 AS found FROM ringi_procedure_bindings binding
          JOIN system_proposal_series series ON series.id = binding.series_id
          WHERE binding.ringi_id = ?1 AND series.created_by_account_id = ?2`).bind(
          input.ringiId,
          input.actorAccountId,
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
      const row = await this.c.env.DB.prepare(`SELECT request_key AS requestKey,
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
        database
          .prepare(`INSERT INTO ringi_procedure_bindings
          (request_key, ringi_id, application_id, series_id, case_id, proposal_digest, created_at)
          VALUES (?1, last_insert_rowid(),
            (SELECT number FROM system_proposal_numbers WHERE series_id = ?2), ?2, ?3, ?4, ?5)`)
          .bind(
            input.requestKey,
            input.workflow.proposal.seriesId,
            input.workflow.workflowCase.id,
            input.workflow.proposal.digest,
            input.workflow.proposal.createdAt.getTime(),
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
      ],
    })
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

  /**
   * 承認/却下を pending からの条件付き UPDATE で確定する。決定済みは 0 行更新となり null を返す。
   * 二重決定を防ぐ冪等性ガード（TOCTOU 競合にも強い）。決裁結果は行に inline 保持する。
   */
  async decideFromPending(props: {
    ringiId: number
    status: "approved" | "rejected"
    decidedAt: string
    decisionComment: string | null
  }): Promise<RingiRequest | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(ringiRequests)
        .set({
          status: props.status,
          decidedAt: props.decidedAt,
          decisionComment: props.decisionComment,
        })
        .where(and(eq(ringiRequests.id, props.ringiId), eq(ringiRequests.status, "pending")))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : RingiRequest.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to decide ringi request")
    }
  }
}
