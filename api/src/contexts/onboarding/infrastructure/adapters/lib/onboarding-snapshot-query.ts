import { z } from "zod"
import {
  decodeOnboardingTemplateTaskRecordId,
  type OnboardingRecordKind,
} from "@/contexts/onboarding/domain/definitions/onboarding-record-kind.definition"

type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string | number> }>

function numericId(recordId: string): number | null {
  const parsed = z.coerce.number().int().safe().safeParse(recordId)
  return parsed.success && String(parsed.data) === recordId ? parsed.data : null
}

/** 手続き6台帳の全列を、業務ロジックに依存しない形式番号付きの原文にする。 */
export function onboardingSnapshotQuery(
  recordKind: OnboardingRecordKind,
  recordId: string,
): SnapshotQuery | Error {
  if (recordKind === "onboarding-template-record") {
    const id = numericId(recordId)
    if (id === null) return new Error("invalid onboarding template id")
    return {
      sql: `SELECT json_object('format','onboarding-template-record','version',1,'template',json_object(
        'id',id,'code',code,'name',name,'kind',kind,'description',description)) AS snapshot_json
        FROM onboarding_templates WHERE id=?1`,
      values: [id],
    }
  }
  if (recordKind === "onboarding-template-task-record") {
    const key = decodeOnboardingTemplateTaskRecordId(recordId)
    if (key === null) return new Error("invalid onboarding template task id")
    return {
      sql: `SELECT json_object('format','onboarding-template-task-record','version',1,'template_task',json_object(
        'template_code',template_code,'code',code,'title',title,'sort_order',sort_order,
        'owner_role',owner_role)) AS snapshot_json FROM onboarding_template_tasks
        WHERE template_code=?1 AND code=?2`,
      values: [key.templateCode, key.code],
    }
  }
  if (recordKind === "onboarding-assignment-record") {
    const id = numericId(recordId)
    if (id === null) return new Error("invalid onboarding assignment id")
    return {
      sql: `SELECT json_object('format','onboarding-assignment-record','version',1,'assignment',json_object(
        'id',id,'employee_id',employee_id,'template_code',template_code,'kind',kind,
        'status',status,'assigned_at',assigned_at,'lifecycle_action_id',lifecycle_action_id))
        AS snapshot_json FROM onboarding_assignments WHERE id=?1`,
      values: [id],
    }
  }
  if (recordKind === "onboarding-task-record") {
    const id = numericId(recordId)
    if (id === null) return new Error("invalid onboarding task id")
    return {
      sql: `SELECT json_object('format','onboarding-task-record','version',1,'task',json_object(
        'id',id,'assignment_id',assignment_id,'template_task_code',template_task_code,
        'title',title,'sort_order',sort_order,'status',status,'completed_at',completed_at))
        AS snapshot_json FROM onboarding_tasks WHERE id=?1`,
      values: [id],
    }
  }
  if (recordKind === "onboarding-lifecycle-template-binding-record") {
    if (recordId !== "hire" && recordId !== "retired")
      return new Error("invalid onboarding lifecycle template binding id")
    return {
      sql: `SELECT json_object('format','onboarding-lifecycle-template-binding-record','version',1,'binding',json_object(
        'effect_type',effect_type,'template_code',template_code,'updated_at',updated_at,
        'updated_by_account_id',updated_by_account_id)) AS snapshot_json
        FROM onboarding_lifecycle_template_bindings WHERE effect_type=?1`,
      values: [recordId],
    }
  }
  if (!z.string().min(1).max(1000).safeParse(recordId).success)
    return new Error("invalid onboarding lifecycle delivery id")
  return {
    sql: `SELECT json_object('format','onboarding-lifecycle-delivery-record','version',1,'delivery',json_object(
      'job_id',job_id,'action_id',action_id,'created_at',created_at,'outcome',outcome,
      'assignment_id',assignment_id,'processed_at',processed_at)) AS snapshot_json
      FROM onboarding_lifecycle_deliveries WHERE job_id=?1`,
    values: [recordId],
  }
}
