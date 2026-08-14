import type { Session } from "@/contexts/company/domain/iam/session"
import { ApplyPersonnelAction } from "@/application/employee-lifecycle/apply-personnel-action"
import { personnelActionInputSchema } from "@/contexts/company/domain/employee-lifecycle/lifecycle-types"
import type { Context } from "@/env"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/d1/abort-when-previous-statement-changed-no-rows"
import { ApplicationError, ConflictError, UnexpectedError, ValidationError } from "@/lib/errors"

type CompletionRow = {
  handler_key: string
  resource_id: string
  payload_fingerprint: string
  target_employee_id: number | null
  payload_json: string
  requested_by_employee_id: number
  base_employee_revision: number | null
  base_organization_revision: number | null
  applied_action_id: string | null
  subject_type: string | null
  subject_snapshot_json: string | null
}

export type PreparedApplicationCompletion = {
  actionId: string
  statements: ReadonlyArray<D1PreparedStatement>
}

export async function prepareApplicationCompletion(props: {
  c: Context
  applicationId: number
  session: Session
}): Promise<PreparedApplicationCompletion | null | ApplicationError> {
  let row: CompletionRow | null
  try {
    row = await props.c.env.DB.prepare(
      `SELECT binding.handler_key, binding.resource_id, binding.payload_fingerprint,
              request.target_employee_id, request.payload_json,
              request.requested_by_employee_id, request.base_employee_revision,
              request.base_organization_revision, request.applied_action_id
              , subject.subject_type, subject.subject_snapshot_json
         FROM application_completion_bindings AS binding
         LEFT JOIN personnel_action_requests AS request ON request.id = binding.resource_id
         LEFT JOIN application_subjects AS subject ON subject.application_id = binding.application_id
         WHERE binding.application_id = ?1`,
    )
      .bind(props.applicationId)
      .first<CompletionRow>()
  } catch (cause) {
    return new UnexpectedError("申請完了処理を読み取れません", { cause })
  }
  if (row === null) return null
  if (row.handler_key !== "personnel_action") {
    return new ValidationError("未知の申請完了処理です", "workflow_unresolvable")
  }
  if (row.base_employee_revision === null || row.applied_action_id !== null) {
    return new ConflictError("人事変更申請を完了できません", "already_decided")
  }
  let input: unknown
  try {
    input = JSON.parse(row.payload_json)
  } catch (cause) {
    return new ValidationError("人事変更申請の内容が不正です", "invalid_payload", { cause })
  }
  const parsed = personnelActionInputSchema.safeParse(input)
  if (!parsed.success) {
    return new ValidationError("人事変更申請の内容が不正です", "invalid_payload", {
      cause: parsed.error,
    })
  }
  if (row.target_employee_id === null) {
    let subject: unknown
    try {
      subject = JSON.parse(row.subject_snapshot_json ?? "null")
    } catch (cause) {
      return new ValidationError("入社申請の対象情報が不正です", "invalid_payload", { cause })
    }
    if (
      row.subject_type !== "prospective_employee" ||
      parsed.data.kind !== "hire" ||
      typeof subject !== "object" ||
      subject === null ||
      !("employeeCode" in subject) ||
      !("employeeName" in subject) ||
      subject.employeeCode !== parsed.data.employeeCode ||
      subject.employeeName !== parsed.data.employeeName
    ) {
      return new ValidationError("入社申請の対象情報が一致しません", "invalid_payload")
    }
  }
  const prepared = await new ApplyPersonnelAction(props.c).prepareApplicationCompletion({
    session: props.session,
    employeeId: row.target_employee_id,
    input: parsed.data,
    sourceApplicationId: props.applicationId,
    requestedByEmployeeId: row.requested_by_employee_id,
    expectedEmployeeRevision: row.base_employee_revision,
    expectedOrganizationRevision: row.base_organization_revision,
    expectedPayloadFingerprint: row.payload_fingerprint,
  })
  if (prepared instanceof ApplicationError) return prepared
  return {
    actionId: prepared.action.id,
    statements: [
      ...prepared.statements,
      props.c.env.DB.prepare(
        `UPDATE personnel_action_requests
           SET applied_action_id = ?2, target_employee_id = ?4
         WHERE id = ?1 AND application_id = ?3 AND applied_action_id IS NULL`,
      ).bind(row.resource_id, prepared.action.id, props.applicationId, prepared.action.employeeId),
      abortWhenPreviousStatementChangedNoRows(props.c.env.DB),
    ],
  }
}
