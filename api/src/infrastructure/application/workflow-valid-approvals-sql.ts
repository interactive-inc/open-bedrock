/**
 * 有効な承認（approve）行を返す SQL 断片。
 * primary 候補、またはエスカレーション後に行われた escalation 候補の承認のみを有効とみなす
 */
export function workflowValidApprovalsSql(props: {
  applicationId: string
  stepKey: string
  round: string
}): string {
  return `SELECT DISTINCT approval.represented_approver_id AS represented_approver_id
    FROM application_workflow_approvals approval
    WHERE approval.application_id = ${props.applicationId}
      AND approval.step_key = ${props.stepKey}
      AND approval.round = ${props.round}
      AND approval.action = 'approve'
      AND EXISTS (
        SELECT 1
        FROM application_workflow_step_snapshots snapshot
        INNER JOIN application_workflow_step_candidates candidate
          ON candidate.application_id = snapshot.application_id
         AND candidate.step_key = snapshot.step_key
         AND candidate.round = snapshot.round
         AND candidate.resolution_id = snapshot.resolution_id
        WHERE snapshot.application_id = approval.application_id
          AND snapshot.step_key = approval.step_key
          AND snapshot.round = approval.round
          AND candidate.candidate_employee_id = approval.represented_approver_id
          AND (
            candidate.source = 'primary'
            OR (snapshot.escalated_at IS NOT NULL AND snapshot.escalated_at <= approval.created_at)
          )
      )`
}
