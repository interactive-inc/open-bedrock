import type { InferSelectModel } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { check, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import type { AccountId } from "@system/domain/auth/account-id"
import { systemAccounts } from "@system/infrastructure/schema/system-core"

/**
 * 申請テンプレート（種類・カテゴリ・入力スキーマ・承認ロール）。
 * schema_json と approver_roles は JSON 文字列で保存される。
 */
export const applicationTemplates = sqliteTable(
  "application_templates",
  {
    id: integer("id").primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description"),
    schemaJson: text("schema_json").notNull(),
    approverRoles: text("approver_roles").notNull(),
    systemBinding: text("system_binding"),
    completionHandlerKey: text("completion_handler_key").$type<"personnel_action">(),
  },
  (table) => [
    uniqueIndex("uq_application_templates_system_binding")
      .on(table.systemBinding)
      .where(sql`system_binding IS NOT NULL`),
  ],
)

export type ApplicationTemplateRow = InferSelectModel<typeof applicationTemplates>

/** 申請（テンプレートに紐づく申請者の提出）。payload は JSON 文字列で保存される。 */
export const applications = sqliteTable(
  "application_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    templateId: integer("template_id").notNull(),
    applicantId: integer("applicant_id").notNull(),
    status: text("status").notNull(),
    currentStep: text("current_step"),
    payload: text("payload").notNull(),
    createdAt: text("created_at").notNull(),
    workflowCreationId: text("workflow_creation_id"),
  },
  (table) => [
    uniqueIndex("uq_applications_workflow_creation")
      .on(table.workflowCreationId)
      .where(sql`workflow_creation_id IS NOT NULL`),
  ],
)

export type ApplicationRow = InferSelectModel<typeof applications>

/** 申請への承認/却下アクションの記録。 */
export const applicationApprovals = sqliteTable("application_approvals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id").notNull(),
  approverId: integer("approver_id").notNull(),
  action: text("action").notNull(),
  comment: text("comment"),
  createdAt: text("created_at").notNull(),
})

export type ApplicationApprovalRow = InferSelectModel<typeof applicationApprovals>

export const applicationSubjects = sqliteTable(
  "application_subjects",
  {
    applicationId: integer("application_id").primaryKey(),
    subjectType: text("subject_type").notNull().$type<"employee" | "prospective_employee">(),
    subjectEmployeeId: integer("subject_employee_id"),
    subjectSnapshotJson: text("subject_snapshot_json"),
    targetDepartmentCode: text("target_department_code"),
  },
  (table) => [
    check(
      "application_subjects_target",
      sql`(${table.subjectType} = 'employee' AND ${table.subjectEmployeeId} IS NOT NULL)
          OR (${table.subjectType} = 'prospective_employee'
              AND ${table.subjectEmployeeId} IS NULL
              AND ${table.subjectSnapshotJson} IS NOT NULL)`,
    ),
  ],
)

export type ApplicationSubjectRow = InferSelectModel<typeof applicationSubjects>

export const applicationCompletionBindings = sqliteTable("application_completion_bindings", {
  applicationId: integer("application_id").primaryKey(),
  handlerKey: text("handler_key").notNull().$type<"personnel_action">(),
  resourceId: text("resource_id").notNull(),
  payloadFingerprint: text("payload_fingerprint").notNull(),
  createdAt: integer("created_at").notNull(),
})

export type ApplicationCompletionBindingRow = InferSelectModel<typeof applicationCompletionBindings>

export const applicationWorkflows = sqliteTable("application_workflows", {
  templateId: integer("template_id").primaryKey(),
  definitionJson: text("definition_json").notNull(),
  updatedAt: text("updated_at").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedByAccountId: text("updated_by_account_id")
    .$type<AccountId>()
    .references(() => systemAccounts.id, { onDelete: "restrict" }),
})

export type ApplicationWorkflowRow = InferSelectModel<typeof applicationWorkflows>

export const applicationWorkflowRevisions = sqliteTable(
  "application_workflow_revisions",
  {
    templateId: integer("template_id").notNull(),
    revision: integer("revision").notNull(),
    definitionJson: text("definition_json").notNull(),
    updatedByAccountId: text("updated_by_account_id")
      .$type<AccountId>()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.templateId, table.revision] })],
)

export type ApplicationWorkflowRevisionRow = InferSelectModel<typeof applicationWorkflowRevisions>

export const applicationWorkflowInstances = sqliteTable("application_workflow_instances", {
  applicationId: integer("application_id").primaryKey(),
  definitionJson: text("definition_json").notNull(),
  currentStepKey: text("current_step_key").notNull(),
  currentRound: integer("current_round").notNull().default(1),
  startedAt: text("started_at").notNull(),
  dueAt: text("due_at"),
})

export type ApplicationWorkflowInstanceRow = InferSelectModel<typeof applicationWorkflowInstances>

export const applicationWorkflowStepSnapshots = sqliteTable(
  "application_workflow_step_snapshots",
  {
    applicationId: integer("application_id").notNull(),
    stepKey: text("step_key").notNull(),
    round: integer("round").notNull(),
    requiredApprovals: integer("required_approvals").notNull(),
    activatedAt: text("activated_at").notNull(),
    dueAt: text("due_at"),
    escalatedAt: text("escalated_at"),
    resolutionReason: text("resolution_reason").notNull(),
    resolutionId: text("resolution_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.applicationId, table.stepKey, table.round] })],
)

export type ApplicationWorkflowStepSnapshotRow = InferSelectModel<
  typeof applicationWorkflowStepSnapshots
>

export const applicationWorkflowStepCandidates = sqliteTable(
  "application_workflow_step_candidates",
  {
    applicationId: integer("application_id").notNull(),
    stepKey: text("step_key").notNull(),
    round: integer("round").notNull(),
    candidateEmployeeId: integer("candidate_employee_id").notNull(),
    candidateAccountId: text("candidate_account_id")
      .notNull()
      .$type<AccountId>()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    source: text("source").notNull(),
    selectorsJson: text("selectors_json").notNull(),
    resolutionId: text("resolution_id").notNull(),
    eligibleFrom: text("eligible_from"),
    resolvedAt: text("resolved_at").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.applicationId,
        table.stepKey,
        table.round,
        table.candidateAccountId,
        table.source,
      ],
    }),
  ],
)

export type ApplicationWorkflowStepCandidateRow = InferSelectModel<
  typeof applicationWorkflowStepCandidates
>

export const applicationWorkflowApprovals = sqliteTable(
  "application_workflow_approvals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    applicationId: integer("application_id").notNull(),
    stepKey: text("step_key").notNull(),
    round: integer("round").notNull().default(1),
    approverId: integer("approver_id").notNull(),
    approverAccountId: text("approver_account_id")
      .$type<AccountId>()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    representedApproverId: integer("represented_approver_id").notNull(),
    delegationId: integer("delegation_id"),
    action: text("action").notNull(),
    comment: text("comment"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uq_workflow_approval_actor_step").on(
      table.applicationId,
      table.stepKey,
      table.round,
      table.approverId,
    ),
  ],
)

export type ApplicationWorkflowApprovalRow = InferSelectModel<typeof applicationWorkflowApprovals>

export const applicationWorkflowEvents = sqliteTable(
  "application_workflow_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    applicationId: integer("application_id").notNull(),
    stepKey: text("step_key").notNull(),
    round: integer("round").notNull(),
    eventType: text("event_type").notNull(),
    actorAccountId: text("actor_account_id")
      .$type<AccountId>()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    occurredAt: text("occurred_at").notNull(),
    detailsJson: text("details_json").notNull(),
  },
  (table) => [
    uniqueIndex("uq_application_workflow_event_once").on(
      table.applicationId,
      table.stepKey,
      table.round,
      table.eventType,
    ),
  ],
)

export type ApplicationWorkflowEventRow = InferSelectModel<typeof applicationWorkflowEvents>

export const approvalDelegations = sqliteTable("approval_delegations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  delegatorEmployeeId: integer("delegator_employee_id").notNull(),
  delegateEmployeeId: integer("delegate_employee_id").notNull(),
  templateCode: text("template_code"),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  createdByAccountId: text("created_by_account_id")
    .$type<AccountId>()
    .references(() => systemAccounts.id, { onDelete: "restrict" }),
  cancelledAt: text("cancelled_at"),
  createdAt: text("created_at").notNull(),
})

export type ApprovalDelegationRow = InferSelectModel<typeof approvalDelegations>
