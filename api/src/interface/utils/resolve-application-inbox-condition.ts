import type { Session } from "@/domain/company/iam/session"
import type { Context } from "@/env"
import { activateDueWorkflowEscalations } from "@/lib/application/activate-due-workflow-escalations"
import { listManagedEmployeeIds } from "@/lib/org/list-managed-employee-ids"
import { applications, applicationTemplates } from "@/schema"
import { and, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm"

/**
 * 申請受信箱の一覧・件数で共有する適格性条件を組み立てる。
 *
 * 旧ワークフローはシステム権限、テンプレートロール、組織スコープをすべて要求する。
 * 設定済みワークフローは固定候補者または有効な代理人だけを対象にする。
 */
export async function resolveApplicationInboxCondition(props: {
  c: Context
  session: Session
  now: string
}): Promise<SQL | Error> {
  const escalated = await activateDueWorkflowEscalations({ c: props.c, now: props.now })
  if (escalated instanceof Error) return escalated

  const isPrivileged = props.session.hasPermission("application:approve")
  const managedEmployeeIds =
    isPrivileged === false || props.session.hasPermission("org:manage")
      ? null
      : await listManagedEmployeeIds(props.c, props.session.employeeId)

  if (managedEmployeeIds instanceof Error) return managedEmployeeIds

  const legacyRoleScope = sql`(
    ${applicationTemplates.approverRoles} = '[]'
    OR EXISTS (
      SELECT 1
      FROM json_each(${applicationTemplates.approverRoles}) configured_role
      INNER JOIN json_each(${JSON.stringify(props.session.roleKeys)}) session_role
        ON session_role.value = configured_role.value
    )
  )`
  const legacyOrganizationScope =
    managedEmployeeIds === null
      ? sql`1 = 1`
      : managedEmployeeIds.length === 0
        ? sql`0 = 1`
        : inArray(applications.applicantId, [...managedEmployeeIds])
  const legacyScope =
    isPrivileged === false ? sql`0 = 1` : and(legacyRoleScope, legacyOrganizationScope)

  const workflowScope = sql`EXISTS (
    SELECT 1
    FROM application_workflow_instances workflow_instance
    INNER JOIN application_workflow_step_snapshots snapshot
      ON snapshot.application_id = workflow_instance.application_id
     AND snapshot.step_key = workflow_instance.current_step_key
     AND snapshot.round = workflow_instance.current_round
    INNER JOIN application_workflow_step_candidates candidate
      ON candidate.application_id = snapshot.application_id
     AND candidate.step_key = snapshot.step_key
     AND candidate.round = snapshot.round
     AND candidate.resolution_id = snapshot.resolution_id
    WHERE workflow_instance.application_id = ${applications.id}
      AND ${applications.currentStep} = workflow_instance.current_step_key
      AND (candidate.source = 'primary' OR snapshot.escalated_at IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1 FROM application_workflow_approvals approval
        WHERE approval.application_id = workflow_instance.application_id
          AND approval.step_key = workflow_instance.current_step_key
          AND approval.round = workflow_instance.current_round
          AND (
            approval.approver_id = ${props.session.employeeId}
            OR approval.represented_approver_id = candidate.candidate_employee_id
          )
      )
      AND EXISTS (
        SELECT 1
        FROM employees candidate_employee
        INNER JOIN account_employee_links candidate_link
          ON candidate_link.employee_id = candidate_employee.id
        INNER JOIN accounts candidate_account
          ON candidate_account.id = candidate_link.account_id
        WHERE candidate_employee.id = candidate.candidate_employee_id
          AND candidate_employee.status <> 'retired'
          AND candidate_account.id = candidate.candidate_account_id
          AND candidate_account.status = 'active'
      )
      AND (
        (candidate.candidate_employee_id = ${props.session.employeeId}
          AND candidate.candidate_account_id = ${props.session.accountId})
        OR (
          EXISTS (
            SELECT 1 FROM json_each(workflow_instance.definition_json, '$.steps') step
            WHERE json_extract(step.value, '$.key') = workflow_instance.current_step_key
              AND COALESCE(json_extract(step.value, '$.allow_delegation'), 1) = 1
          )
          AND EXISTS (
            SELECT 1 FROM approval_delegations delegation
            WHERE delegation.delegate_employee_id = ${props.session.employeeId}
              AND delegation.delegator_employee_id = candidate.candidate_employee_id
              AND delegation.cancelled_at IS NULL
              AND delegation.starts_at <= ${props.now}
              AND delegation.ends_at > ${props.now}
              AND (
                delegation.template_code IS NULL
                OR delegation.template_code = ${applicationTemplates.code}
              )
          )
        )
      )
  )`

  return and(
    eq(applications.status, "pending"),
    ne(applications.applicantId, props.session.employeeId),
    or(
      workflowScope,
      and(
        sql`NOT EXISTS (
          SELECT 1 FROM application_workflow_instances workflow_instance
          WHERE workflow_instance.application_id = ${applications.id}
        )`,
        legacyScope,
      ),
    ),
  ) as SQL
}
