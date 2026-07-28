import type { Context } from "@/env"
import {
  ApplicationWorkflowRepository,
  type WorkflowStepSnapshot,
} from "@/infrastructure/application/application-workflow-repository"

/**
 * 対象ステップの期限が過ぎていればエスカレーションを有効化し、更新後のスナップショットを返す。
 * 未到達・期限なし・既にエスカレーション済みなら入力スナップショットをそのまま返す
 */
export async function ensureWorkflowStepEscalation(props: {
  c: Context
  snapshot: WorkflowStepSnapshot
  now: string
}): Promise<WorkflowStepSnapshot | Error> {
  if (
    props.snapshot.escalatedAt !== null ||
    props.snapshot.dueAt === null ||
    props.now < props.snapshot.dueAt
  ) {
    return props.snapshot
  }

  try {
    await props.c.env.DB.batch([
      props.c.env.DB.prepare(
        `UPDATE application_workflow_step_snapshots
           SET escalated_at = ?4
           WHERE application_id = ?1 AND step_key = ?2 AND round = ?3
             AND escalated_at IS NULL AND due_at IS NOT NULL AND due_at <= ?4
             AND EXISTS (
               SELECT 1
               FROM application_workflow_instances workflow_instance
               INNER JOIN application_requests application
                 ON application.id = workflow_instance.application_id
               WHERE workflow_instance.application_id = ?1
                 AND workflow_instance.current_step_key = ?2
                 AND workflow_instance.current_round = ?3
                 AND application.status = 'pending'
                 AND application.current_step = ?2
             )
           RETURNING escalated_at`,
      ).bind(props.snapshot.applicationId, props.snapshot.stepKey, props.snapshot.round, props.now),
      props.c.env.DB.prepare(
        `INSERT OR IGNORE INTO application_workflow_events
             (application_id, step_key, round, event_type, actor_account_id,
              occurred_at, details_json)
           SELECT application_id, step_key, round, 'escalated', NULL,
                  escalated_at, json_object('due_at', due_at)
           FROM application_workflow_step_snapshots
           WHERE application_id = ?1 AND step_key = ?2 AND round = ?3
             AND escalated_at IS NOT NULL`,
      ).bind(props.snapshot.applicationId, props.snapshot.stepKey, props.snapshot.round),
    ])
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to activate workflow escalation")
  }

  const persisted = await new ApplicationWorkflowRepository(props.c).findStepSnapshot(
    props.snapshot.applicationId,
    props.snapshot.stepKey,
    props.snapshot.round,
  )

  return persisted ?? new Error("workflow step snapshot disappeared during escalation")
}
