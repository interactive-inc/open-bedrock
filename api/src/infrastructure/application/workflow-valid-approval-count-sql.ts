import { workflowValidApprovalsSql } from "@/infrastructure/application/workflow-valid-approvals-sql"

/**
 * 有効な承認数を数える SQL 断片
 */
export function workflowValidApprovalCountSql(props: {
  applicationId: string
  stepKey: string
  round: string
}): string {
  return `SELECT COUNT(*) FROM (${workflowValidApprovalsSql(props)})`
}
