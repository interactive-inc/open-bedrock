import type {
  SystemWorkflowDecisionPersistence,
  SystemWorkflowDecisionResult,
  SystemWorkflowWriter,
} from "@system/application/workflow/system-workflow-writer"
import { SystemD1WorkflowWriter } from "@system/infrastructure/workflow/system-d1-workflow-writer"
import type { Context } from "@/env"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"

export type PersonnelActionSystemAssociation = Readonly<{
  id: string
  targetEmployeeId: number | null
  subjectSnapshotJson: string | null
  targetDepartmentCode: string | null
  kind: string
  payloadJson: string
  payloadFingerprint: string
  requestedByEmployeeId: number
  baseEmployeeRevision: number
  baseOrganizationRevision: number | null
  createdAt: number
  auditStatements: ReadonlyArray<D1PreparedStatement>
}>

/** System workflow開始とCompany人事申請の関連付けを一つのD1 transactionへ合成する。 */
export class PersonnelActionSystemWorkflowWriter implements SystemWorkflowWriter {
  private readonly systemWriter: SystemD1WorkflowWriter

  constructor(
    private readonly c: Context,
    private readonly association: PersonnelActionSystemAssociation,
  ) {
    this.systemWriter = new SystemD1WorkflowWriter({ env: { DB: c.env.DB } })
  }

  async start(input: Parameters<SystemWorkflowWriter["start"]>[0]): Promise<number | Error> {
    const statements = [...this.systemWriter.prepareStartStatements(input)]
    const numberQuery = statements.pop()
    if (numberQuery === undefined) return new Error("System proposal number query is missing")

    try {
      const results = await this.c.env.DB.batch<{ number: number }>([
        ...statements,
        this.c.env.DB.prepare(
          `INSERT INTO personnel_action_requests
               (id, application_id, system_proposal_series_id, target_employee_id,
                subject_snapshot_json, target_department_code, kind, payload_json,
                payload_fingerprint, requested_by_employee_id, base_employee_revision,
                base_organization_revision, created_at, applied_action_id)
             SELECT ?1, number.number, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, NULL
             FROM system_proposal_numbers AS number
             WHERE number.series_id = ?2`,
        ).bind(
          this.association.id,
          input.proposal.seriesId,
          this.association.targetEmployeeId,
          this.association.subjectSnapshotJson,
          this.association.targetDepartmentCode,
          this.association.kind,
          this.association.payloadJson,
          this.association.payloadFingerprint,
          this.association.requestedByEmployeeId,
          this.association.baseEmployeeRevision,
          this.association.baseOrganizationRevision,
          this.association.createdAt,
        ),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        ...this.association.auditStatements,
        numberQuery,
      ])
      const number = results.at(-1)?.results.at(0)?.number

      return number ?? new Error("System proposal number is missing")
    } catch (cause) {
      return cause instanceof Error
        ? cause
        : new Error("failed to create Company personnel action procedure", { cause })
    }
  }

  decide(input: SystemWorkflowDecisionPersistence): Promise<SystemWorkflowDecisionResult | Error> {
    return this.systemWriter.decide(input)
  }

  cancel(
    input: Parameters<SystemWorkflowWriter["cancel"]>[0],
  ): ReturnType<SystemWorkflowWriter["cancel"]> {
    return this.systemWriter.cancel(input)
  }

  reassign(
    input: Parameters<SystemWorkflowWriter["reassign"]>[0],
  ): ReturnType<SystemWorkflowWriter["reassign"]> {
    return this.systemWriter.reassign(input)
  }
}
