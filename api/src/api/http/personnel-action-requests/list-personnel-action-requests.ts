import type {
  PersonnelActionRequestRecord,
  PersonnelActionRequestStatus,
} from "@/contexts/company/domain/definitions/personnel-action-request-record.definition"
import { personnelActionInputSchema } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { Context } from "@/env"
import type { Session } from "@/lib/auth/session"
import { UnexpectedError } from "@/lib/errors"
import { ReadSystemWorkflowReferencesAdapter } from "@system/infrastructure/adapters/workflow/read-system-workflow-references.adapter"

type Filters = Readonly<{
  targetEmployeeCode?: string
  status?: PersonnelActionRequestStatus
  limit: number
}>

/** Company申請とSystemの判断状態を、現在の参加者scopeで一覧へ合成する。 */
export class ListPersonnelActionRequests {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    session: Session,
    filters: Filters,
  ): Promise<ReadonlyArray<PersonnelActionRequestRecord> | UnexpectedError> {
    try {
      const rows = await this.c.env.DB.prepare(
        `SELECT request.id, request.application_id, request.system_proposal_series_id,
                request.target_employee_id, request.target_department_code,
                COALESCE(target.employee_code,
                  json_extract(request.subject_snapshot_json, '$.employeeCode'))
                  AS target_employee_code,
                COALESCE(target.official_name,
                  json_extract(request.subject_snapshot_json, '$.employeeName'))
                  AS target_employee_name,
                request.kind, request.payload_json, request.payload_fingerprint,
                request.requested_by_employee_id,
                requester.employee_code AS requested_by_employee_code,
                requester.official_name AS requested_by_employee_name,
                request.base_employee_revision, request.base_organization_revision,
                request.created_at, request.applied_action_id, request.withdrawn_at
         FROM company_personnel_action_requests AS request
         LEFT JOIN company_employees AS target ON target.id = request.target_employee_id
         JOIN company_employees AS requester ON requester.id = request.requested_by_employee_id
         WHERE ?1 IS NULL
            OR target.employee_code = ?1
            OR json_extract(request.subject_snapshot_json, '$.employeeCode') = ?1
         ORDER BY request.created_at DESC, request.id DESC`,
      )
        .bind(filters.targetEmployeeCode ?? null)
        .all<{
          id: string
          application_id: number
          system_proposal_series_id: string | null
          target_employee_id: EmployeeId | null
          target_department_code: string | null
          target_employee_code: string | null
          target_employee_name: string | null
          kind: string
          payload_json: string
          payload_fingerprint: string | null
          requested_by_employee_id: EmployeeId
          requested_by_employee_code: string | null
          requested_by_employee_name: string
          base_employee_revision: number | null
          base_organization_revision: number | null
          created_at: number
          applied_action_id: string | null
          withdrawn_at: number | null
        }>()
      const workflows = await new ReadSystemWorkflowReferencesAdapter({
        env: { DB: this.c.env.DB },
      }).readSystemWorkflowReferences({
        numbers: rows.results.map((row) => row.application_id),
        actorAccountId: session.accountId,
        includeAll: session.hasPermission("employee:lifecycle:read:all"),
        at: new Date(this.c.env.NOW ?? Date.now()),
      })
      if (workflows instanceof Error) {
        return new UnexpectedError("人事変更申請の一覧を取得できません", { cause: workflows })
      }
      const workflowByNumber = new Map(workflows.map((workflow) => [workflow.number, workflow]))
      const requests: PersonnelActionRequestRecord[] = []
      for (const row of rows.results) {
        const workflow = workflowByNumber.get(row.application_id)
        if (workflow === undefined) continue
        const action = personnelActionInputSchema.safeParse(JSON.parse(row.payload_json))
        if (
          !action.success ||
          row.system_proposal_series_id === null ||
          row.system_proposal_series_id !== workflow.seriesId ||
          row.payload_fingerprint === null ||
          row.target_employee_code === null ||
          row.target_employee_name === null ||
          row.requested_by_employee_code === null ||
          row.base_employee_revision === null
        ) {
          return new UnexpectedError("人事変更申請の保存データが不正です")
        }
        const status: PersonnelActionRequestStatus =
          row.withdrawn_at !== null
            ? "withdrawn"
            : workflow.status === "pending"
              ? "pending"
              : workflow.status === "approved" || workflow.status === "executed"
                ? "approved"
                : "rejected"
        if (filters.status !== undefined && filters.status !== status) continue
        requests.push({
          id: row.id,
          applicationId: row.application_id,
          systemProposalSeriesId: row.system_proposal_series_id,
          systemCaseId: workflow.caseId,
          proposalDigest: workflow.proposalDigest,
          targetEmployeeId: row.target_employee_id,
          targetEmployeeCode: row.target_employee_code,
          targetEmployeeName: row.target_employee_name,
          targetDepartmentCode: row.target_department_code,
          kind: row.kind,
          action: action.data,
          payloadFingerprint: row.payload_fingerprint,
          requestedByEmployeeId: row.requested_by_employee_id,
          requestedByEmployeeCode: row.requested_by_employee_code,
          requestedByEmployeeName: row.requested_by_employee_name,
          baseEmployeeRevision: row.base_employee_revision,
          baseOrganizationRevision: row.base_organization_revision,
          status,
          currentStep: workflow.currentTaskKey,
          createdAt: row.created_at,
          appliedActionId: row.applied_action_id,
          withdrawnAt: row.withdrawn_at,
        })
        if (requests.length === filters.limit) break
      }
      return requests
    } catch (cause) {
      return new UnexpectedError("人事変更申請の一覧を取得できません", { cause })
    }
  }
}
