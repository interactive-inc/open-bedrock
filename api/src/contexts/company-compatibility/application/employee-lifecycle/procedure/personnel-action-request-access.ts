import type { PersonnelActionInput } from "@/contexts/company-compatibility/domain/employee-lifecycle/lifecycle-types"
import { personnelActionInputSchema } from "@/contexts/company-compatibility/domain/employee-lifecycle/lifecycle-types"
import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import type { Context } from "@/env"
import { UnexpectedError } from "@/lib/errors"
import { z } from "zod"

const personnelActionRequestStatusSchema = z.enum(["pending", "approved", "rejected", "withdrawn"])

export type PersonnelActionRequestStatus = z.infer<typeof personnelActionRequestStatusSchema>

export type PersonnelActionRequestRecord = {
  id: string
  applicationId: number
  systemProposalSeriesId: string
  systemCaseId: string
  proposalDigest: string
  targetEmployeeId: number | null
  targetEmployeeCode: string
  targetEmployeeName: string
  targetDepartmentCode: string | null
  kind: string
  action: PersonnelActionInput
  payloadFingerprint: string
  requestedByEmployeeId: number
  requestedByEmployeeCode: string
  requestedByEmployeeName: string
  baseEmployeeRevision: number
  baseOrganizationRevision: number | null
  status: PersonnelActionRequestStatus
  currentStep: string | null
  createdAt: number
  appliedActionId: string | null
  withdrawnAt: number | null
}

type RequestRow = {
  id: string
  application_id: number
  system_proposal_series_id: string | null
  system_case_id: string
  proposal_digest: string
  target_employee_id: number | null
  target_employee_code: string | null
  target_employee_name: string | null
  target_department_code: string | null
  kind: string
  payload_json: string
  payload_fingerprint: string | null
  requested_by_employee_id: number
  requested_by_employee_code: string
  requested_by_employee_name: string
  base_employee_revision: number | null
  base_organization_revision: number | null
  status: string
  current_step: string | null
  created_at: number
  applied_action_id: string | null
  withdrawn_at: number | null
}

type Props = {
  c: Context
  session: Session
}

type ListFilters = {
  targetEmployeeCode?: string
  status?: PersonnelActionRequestStatus
  limit: number
}

/** System判断状態とCompany人事データを、参加者scopeで結合して読む。 */
export class PersonnelActionRequestAccess {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async find(requestId: string): Promise<PersonnelActionRequestRecord | null | UnexpectedError> {
    try {
      const row = await this.props.c.env.DB.prepare(
        `${this.selectSql()}
         WHERE request.id = ?5 AND ${this.participantSql()}`,
      )
        .bind(
          this.props.session.employeeId,
          String(this.props.session.accountId),
          this.props.session.hasPermission("employee:lifecycle:read:all") ? 1 : 0,
          this.nowMilliseconds(),
          requestId,
        )
        .first<RequestRow>()
      return row === null ? null : this.decode(row)
    } catch (cause) {
      return new UnexpectedError("人事変更申請を取得できません", { cause })
    }
  }

  async findByApplicationId(
    applicationId: number,
  ): Promise<PersonnelActionRequestRecord | null | UnexpectedError> {
    try {
      const row = await this.props.c.env.DB.prepare(
        `${this.selectSql()}
         WHERE request.application_id = ?5 AND ${this.participantSql()}`,
      )
        .bind(
          this.props.session.employeeId,
          String(this.props.session.accountId),
          this.props.session.hasPermission("employee:lifecycle:read:all") ? 1 : 0,
          this.nowMilliseconds(),
          applicationId,
        )
        .first<RequestRow>()
      return row === null ? null : this.decode(row)
    } catch (cause) {
      return new UnexpectedError("人事変更申請を取得できません", { cause })
    }
  }

  async list(
    filters: ListFilters,
  ): Promise<ReadonlyArray<PersonnelActionRequestRecord> | UnexpectedError> {
    try {
      const rows = await this.props.c.env.DB.prepare(
        `${this.selectSql()}
         WHERE ${this.participantSql()}
           AND (?5 IS NULL OR target.code = ?5 OR json_extract(request.subject_snapshot_json, '$.employeeCode') = ?5)
           AND (?6 IS NULL OR ${this.statusSql()} = ?6)
         ORDER BY request.created_at DESC, request.id DESC
         LIMIT ?7`,
      )
        .bind(
          this.props.session.employeeId,
          String(this.props.session.accountId),
          this.props.session.hasPermission("employee:lifecycle:read:all") ? 1 : 0,
          this.nowMilliseconds(),
          filters.targetEmployeeCode ?? null,
          filters.status ?? null,
          filters.limit,
        )
        .all<RequestRow>()
      return rows.results.map((row) => this.decode(row))
    } catch (cause) {
      return new UnexpectedError("人事変更申請の一覧を取得できません", { cause })
    }
  }

  private nowMilliseconds(): number {
    return new Date(this.props.c.env.NOW ?? Date.now()).getTime()
  }

  private statusSql(): string {
    return `CASE
      WHEN request.withdrawn_at IS NOT NULL THEN 'withdrawn'
      WHEN workflow_case.status = 'pending' THEN 'pending'
      WHEN workflow_case.status IN ('approved', 'executed') THEN 'approved'
      ELSE 'rejected'
    END`
  }

  private participantSql(): string {
    return `(?3 = 1
    OR request.requested_by_employee_id = ?1
    OR EXISTS (
      SELECT 1 FROM system_decision_task_candidates AS candidate
      WHERE candidate.case_id = workflow_case.id AND candidate.candidate_account_id = ?2
    )
    OR EXISTS (
      SELECT 1 FROM system_human_attestations AS attestation
      WHERE attestation.case_id = workflow_case.id
        AND (attestation.actor_account_id = ?2 OR attestation.represented_account_id = ?2)
    )
    OR EXISTS (
      SELECT 1
      FROM system_delegations AS delegation
      WHERE delegation.delegate_account_id = ?2
        AND delegation.starts_at <= ?4 AND delegation.ends_at > ?4
        AND (delegation.revoked_at IS NULL OR delegation.revoked_at > ?4)
        AND EXISTS (
          SELECT 1 FROM system_decision_task_candidates AS delegated_candidate
          WHERE delegated_candidate.case_id = workflow_case.id
            AND delegated_candidate.candidate_account_id = delegation.delegator_account_id
        )
        AND (
          delegation.scope_context IS NULL
          OR (
            delegation.scope_context = workflow_case.subject_context
            AND delegation.scope_kind = workflow_case.subject_kind
            AND delegation.scope_id = workflow_case.subject_id
            AND delegation.scope_version = workflow_case.subject_version
          )
        )
        AND (
          NOT EXISTS (
            SELECT 1 FROM system_delegation_procedure_scopes
            WHERE delegation_id = delegation.id
          )
          OR EXISTS (
            SELECT 1 FROM system_delegation_procedure_scopes
            WHERE delegation_id = delegation.id
              AND procedure_key = proposal.procedure_key
          )
        )
    ))`
  }

  private selectSql(): string {
    return `SELECT request.id, request.application_id, request.system_proposal_series_id,
    workflow_case.id AS system_case_id, proposal.digest AS proposal_digest,
    request.target_employee_id, request.target_department_code,
    COALESCE(target.code, json_extract(request.subject_snapshot_json, '$.employeeCode'))
      AS target_employee_code,
    COALESCE(target.name, json_extract(request.subject_snapshot_json, '$.employeeName'))
      AS target_employee_name,
    request.kind, request.payload_json, request.payload_fingerprint,
    request.requested_by_employee_id,
    requester.code AS requested_by_employee_code, requester.name AS requested_by_employee_name,
    request.base_employee_revision, request.base_organization_revision,
    ${this.statusSql()} AS status,
    (
      SELECT task.task_key FROM system_decision_tasks AS task
      WHERE task.case_id = workflow_case.id AND task.outcome IS NULL
      ORDER BY task.opened_at DESC, task.round DESC LIMIT 1
    ) AS current_step,
    request.created_at, request.applied_action_id, request.withdrawn_at
  FROM personnel_action_requests AS request
  JOIN system_proposal_numbers AS number ON number.number = request.application_id
    AND number.series_id = request.system_proposal_series_id
  JOIN system_proposals AS proposal ON proposal.series_id = number.series_id
    AND proposal.version = (
      SELECT max(latest.version) FROM system_proposals AS latest
      WHERE latest.series_id = number.series_id
    )
  JOIN system_proposal_cases AS proposal_case ON proposal_case.proposal_id = proposal.id
  JOIN system_cases AS workflow_case ON workflow_case.id = proposal_case.case_id
  LEFT JOIN employees AS target ON target.id = request.target_employee_id
  JOIN employees AS requester ON requester.id = request.requested_by_employee_id`
  }

  private decode(row: RequestRow): PersonnelActionRequestRecord {
    const action = personnelActionInputSchema.safeParse(JSON.parse(row.payload_json))
    const status = personnelActionRequestStatusSchema.safeParse(row.status)
    if (
      !action.success ||
      !status.success ||
      row.system_proposal_series_id === null ||
      row.payload_fingerprint === null ||
      row.target_employee_code === null ||
      row.target_employee_name === null ||
      row.base_employee_revision === null
    ) {
      throw new Error("invalid personnel action request row")
    }

    return {
      id: row.id,
      applicationId: row.application_id,
      systemProposalSeriesId: row.system_proposal_series_id,
      systemCaseId: row.system_case_id,
      proposalDigest: row.proposal_digest,
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
      status: status.data,
      currentStep: row.current_step,
      createdAt: row.created_at,
      appliedActionId: row.applied_action_id,
      withdrawnAt: row.withdrawn_at,
    }
  }
}
