import type { Context } from "@/env"

/**
 * 期限を過ぎた保留中ステップのエスカレーションを一括で有効化し、escalated イベントを記録する
 */
export async function activateDueWorkflowEscalations(props: {
  c: Context
  now: string
}): Promise<null | Error> {
  try {
    await props.c.env.DB.batch([
      props.c.env.DB.prepare(
        `UPDATE application_workflow_step_snapshots AS snapshot
           SET escalated_at = ?1
           WHERE snapshot.escalated_at IS NULL
             AND snapshot.due_at IS NOT NULL
             AND snapshot.due_at <= ?1
             AND EXISTS (
               SELECT 1
               FROM application_workflow_instances workflow_instance
               INNER JOIN applications application
                 ON application.id = workflow_instance.application_id
               WHERE workflow_instance.application_id = snapshot.application_id
                 AND workflow_instance.current_step_key = snapshot.step_key
                 AND workflow_instance.current_round = snapshot.round
                 AND application.status = 'pending'
                 AND application.current_step = snapshot.step_key
             )`,
      ).bind(props.now),
      props.c.env.DB.prepare(
        `INSERT OR IGNORE INTO application_workflow_events
           (application_id, step_key, round, event_type, actor_account_id,
            occurred_at, details_json)
         SELECT snapshot.application_id, snapshot.step_key, snapshot.round,
                'escalated', NULL, snapshot.escalated_at,
                json_object('due_at', snapshot.due_at)
         FROM application_workflow_step_snapshots snapshot
         WHERE snapshot.escalated_at IS NOT NULL`,
      ),
    ])

    return null
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to activate due escalations")
  }
}
