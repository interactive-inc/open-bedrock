import type { Context } from "@/env"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"

type Input = Readonly<{
  id: string
  applicationId: number
  systemProposalSeriesId: string
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

/** System procedure開始後のCompany申請関連付けと監査を一つのD1 batchで保存する。 */
export class CreatePersonnelActionRequestAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async create(input: Input): Promise<true | Error> {
    try {
      await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `INSERT INTO personnel_action_requests
             (id, application_id, system_proposal_series_id, target_employee_id,
              subject_snapshot_json, target_department_code, kind, payload_json,
              payload_fingerprint, requested_by_employee_id, base_employee_revision,
              base_organization_revision, created_at, applied_action_id)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, NULL)`,
        ).bind(
          input.id,
          input.applicationId,
          input.systemProposalSeriesId,
          input.targetEmployeeId,
          input.subjectSnapshotJson,
          input.targetDepartmentCode,
          input.kind,
          input.payloadJson,
          input.payloadFingerprint,
          input.requestedByEmployeeId,
          input.baseEmployeeRevision,
          input.baseOrganizationRevision,
          input.createdAt,
        ),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        ...input.auditStatements,
      ])
      return true
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to create Company personnel action request")
    }
  }
}
