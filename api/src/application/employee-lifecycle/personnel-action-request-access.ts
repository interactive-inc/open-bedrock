import type { Session } from "@/domain/company/iam/session"
import type { PersonnelActionInput } from "@/domain/employee-lifecycle/lifecycle-types"
import { personnelActionInputSchema } from "@/domain/employee-lifecycle/lifecycle-types"
import type { Context } from "@/env"
import { UnexpectedError } from "@/lib/errors"

export type PersonnelActionRequestStatus = "pending" | "approved" | "rejected" | "withdrawn"

export type PersonnelActionRequestRecord = {
  id: string
  applicationId: number
  targetEmployeeId: number | null
  targetEmployeeCode: string
  targetEmployeeName: string
  kind: string
  action: PersonnelActionInput
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
  target_employee_id: number | null
  target_employee_code: string | null
  target_employee_name: string | null
  kind: string
  payload_json: string
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

/**
 * 人事変更申請の参加者スコープ付き読み取り。
 * 申請者本人・ワークフロー候補者、または全社閲覧権限を持つ者だけに絞り、
 * 単件取得と一覧取得を提供する
 */
export class PersonnelActionRequestAccess {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async find(requestId: string): Promise<PersonnelActionRequestRecord | null | UnexpectedError> {
    try {
      const row = await this.props.c.env.DB.prepare(
        `${this.selectSql()}
         WHERE request.id = ?3 AND ${this.participantSql()}`,
      )
        .bind(
          this.props.session.employeeId,
          this.props.session.hasPermission("employee:lifecycle:read:all") ? 1 : 0,
          requestId,
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
           AND (?3 IS NULL OR target.code = ?3)
           AND (?4 IS NULL OR ${this.statusSql()} = ?4)
         ORDER BY request.created_at DESC, request.id DESC
         LIMIT ?5`,
      )
        .bind(
          this.props.session.employeeId,
          this.props.session.hasPermission("employee:lifecycle:read:all") ? 1 : 0,
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

  private statusSql(alias = "request"): string {
    return `CASE WHEN ${alias}.withdrawn_at IS NOT NULL THEN 'withdrawn' ELSE application.status END`
  }

  private participantSql(): string {
    return `(?2 = 1
    OR request.requested_by_employee_id = ?1
    OR EXISTS (
      SELECT 1 FROM application_workflow_step_candidates candidate
      WHERE candidate.application_id = application.id
        AND candidate.candidate_employee_id = ?1
    ))`
  }

  private selectSql(): string {
    return `SELECT request.id, request.application_id, request.target_employee_id,
    COALESCE(target.code, json_extract(subject.subject_snapshot_json, '$.employeeCode'))
      AS target_employee_code,
    COALESCE(target.name, json_extract(subject.subject_snapshot_json, '$.employeeName'))
      AS target_employee_name,
    request.kind, request.payload_json, request.requested_by_employee_id,
    requester.code AS requested_by_employee_code, requester.name AS requested_by_employee_name,
    request.base_employee_revision, request.base_organization_revision,
    ${this.statusSql()} AS status, application.current_step, request.created_at,
    request.applied_action_id, request.withdrawn_at
  FROM personnel_action_requests request
  INNER JOIN application_requests application ON application.id = request.application_id
  INNER JOIN application_subjects subject ON subject.application_id = application.id
  LEFT JOIN employees target ON target.id = request.target_employee_id
  INNER JOIN employees requester ON requester.id = request.requested_by_employee_id`
  }

  private decode(row: RequestRow): PersonnelActionRequestRecord {
    const action = personnelActionInputSchema.safeParse(JSON.parse(row.payload_json))

    if (
      !action.success ||
      row.target_employee_code === null ||
      row.target_employee_name === null ||
      row.base_employee_revision === null ||
      !["pending", "approved", "rejected", "withdrawn"].includes(row.status)
    ) {
      throw new Error("invalid personnel action request row")
    }

    return {
      id: row.id,
      applicationId: row.application_id,
      targetEmployeeId: row.target_employee_id,
      targetEmployeeCode: row.target_employee_code,
      targetEmployeeName: row.target_employee_name,
      kind: row.kind,
      action: action.data,
      requestedByEmployeeId: row.requested_by_employee_id,
      requestedByEmployeeCode: row.requested_by_employee_code,
      requestedByEmployeeName: row.requested_by_employee_name,
      baseEmployeeRevision: row.base_employee_revision,
      baseOrganizationRevision: row.base_organization_revision,
      status: row.status as PersonnelActionRequestStatus,
      currentStep: row.current_step,
      createdAt: row.created_at,
      appliedActionId: row.applied_action_id,
      withdrawnAt: row.withdrawn_at,
    }
  }
}
