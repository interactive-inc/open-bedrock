import type { PersonnelActionRequestRecord } from "@/contexts/company/domain/employee-lifecycle/personnel-action-request-record"
import { personnelActionInputSchema } from "@/contexts/company/domain/employee-lifecycle/lifecycle-types"
import type { Session } from "@/contexts/company/domain/iam/session"
import type { Context } from "@/env"
import { UnexpectedError } from "@/lib/errors"
import { readSystemWorkflowReferences } from "@system/infrastructure/workflow/read-system-workflow-references.repository"

/** Company申請1件とSystem判断状態を、認可済みの表示recordへ合成する。 */
export async function findPersonnelActionRequest(
  context: Context,
  session: Session,
  selector: Readonly<{ id: string } | { applicationId: number }>,
): Promise<PersonnelActionRequestRecord | null | UnexpectedError> {
  try {
    const byId = "id" in selector
    const row = await context.env.DB.prepare(
      `SELECT request.id, request.application_id, request.system_proposal_series_id,
              request.target_employee_id, request.target_department_code,
              COALESCE(target.code, json_extract(request.subject_snapshot_json, '$.employeeCode'))
                AS target_employee_code,
              COALESCE(target.name, json_extract(request.subject_snapshot_json, '$.employeeName'))
                AS target_employee_name,
              request.kind, request.payload_json, request.payload_fingerprint,
              request.requested_by_employee_id,
              requester.code AS requested_by_employee_code,
              requester.name AS requested_by_employee_name,
              request.base_employee_revision, request.base_organization_revision,
              request.created_at, request.applied_action_id, request.withdrawn_at
       FROM personnel_action_requests AS request
       LEFT JOIN employees AS target ON target.id = request.target_employee_id
       JOIN employees AS requester ON requester.id = request.requested_by_employee_id
       WHERE ${byId ? "request.id" : "request.application_id"} = ?1`,
    )
      .bind(byId ? selector.id : selector.applicationId)
      .first<{
        id: string
        application_id: number
        system_proposal_series_id: string | null
        target_employee_id: number | null
        target_department_code: string | null
        target_employee_code: string | null
        target_employee_name: string | null
        kind: string
        payload_json: string
        payload_fingerprint: string | null
        requested_by_employee_id: number
        requested_by_employee_code: string
        requested_by_employee_name: string
        base_employee_revision: number | null
        base_organization_revision: number | null
        created_at: number
        applied_action_id: string | null
        withdrawn_at: number | null
      }>()
    if (row === null) return null

    const workflows = await readSystemWorkflowReferences(
      { env: { DB: context.env.DB } },
      {
        numbers: [row.application_id],
        actorAccountId: session.accountId,
        includeAll: session.hasPermission("employee:lifecycle:read:all"),
        at: new Date(context.env.NOW ?? Date.now()),
      },
    )
    if (workflows instanceof Error) {
      return new UnexpectedError("人事変更申請を取得できません", { cause: workflows })
    }
    const workflow = workflows.at(0)
    if (workflow === undefined) return null

    const action = personnelActionInputSchema.safeParse(JSON.parse(row.payload_json))
    if (
      !action.success ||
      row.system_proposal_series_id === null ||
      row.system_proposal_series_id !== workflow.seriesId ||
      row.payload_fingerprint === null ||
      row.target_employee_code === null ||
      row.target_employee_name === null ||
      row.base_employee_revision === null
    ) {
      return new UnexpectedError("人事変更申請の保存データが不正です")
    }

    return {
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
      status:
        row.withdrawn_at !== null
          ? "withdrawn"
          : workflow.status === "pending"
            ? "pending"
            : workflow.status === "approved" || workflow.status === "executed"
              ? "approved"
              : "rejected",
      currentStep: workflow.currentTaskKey,
      createdAt: row.created_at,
      appliedActionId: row.applied_action_id,
      withdrawnAt: row.withdrawn_at,
    }
  } catch (cause) {
    return new UnexpectedError("人事変更申請を取得できません", { cause })
  }
}
