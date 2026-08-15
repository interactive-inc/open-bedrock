import { workflowValidApprovalsSql } from "@/contexts/request/infrastructure/workflow-valid-approvals-sql"

/**
 * 到達可能な承認数を数える SQL 断片。
 * 既存の有効な承認に加え、いまも active な候補（primary、またはエスカレーション済みの escalation）を合算する
 */
export function workflowReachableApprovalCountSql(props: {
  applicationId: string
  stepKey: string
  round: string
}): string {
  return `SELECT COUNT(*) FROM (
    SELECT represented_approver_id
    FROM (${workflowValidApprovalsSql(props)})
    UNION
    SELECT candidate.candidate_employee_id AS represented_approver_id
    FROM application_workflow_step_snapshots snapshot
    INNER JOIN application_workflow_step_candidates candidate
      ON candidate.application_id = snapshot.application_id
     AND candidate.step_key = snapshot.step_key
     AND candidate.round = snapshot.round
     AND candidate.resolution_id = snapshot.resolution_id
    INNER JOIN system_accounts candidate_account
      ON candidate_account.id = candidate.candidate_account_id
     AND candidate_account.status = 'active'
    INNER JOIN account_employee_links candidate_link
      ON CAST(candidate_link.account_id AS TEXT) = candidate_account.id
     AND candidate_link.employee_id = candidate.candidate_employee_id
    INNER JOIN employees candidate_employee
      ON candidate_employee.id = candidate.candidate_employee_id
     AND candidate_employee.status <> 'retired'
    WHERE snapshot.application_id = ${props.applicationId}
      AND snapshot.step_key = ${props.stepKey}
      AND snapshot.round = ${props.round}
      AND (
        candidate.source = 'primary'
        OR (candidate.source = 'escalation' AND snapshot.escalated_at IS NOT NULL)
      )
  )`
}
