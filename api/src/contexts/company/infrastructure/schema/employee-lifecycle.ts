import type { PersonnelActionKind } from "@/contexts/company/domain/employee-lifecycle/lifecycle-types"
import type { AccountId } from "@system/domain/auth/account-id"
import type { InferSelectModel } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { check, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** 人事アクション台帳。事実は追記のみで、訂正も corrected アクションとして記録する。 */
export const personnelActions = sqliteTable(
  "personnel_actions",
  {
    id: text("id").primaryKey(),
    employeeId: integer("employee_id").notNull(),
    kind: text("kind").notNull().$type<PersonnelActionKind>(),
    eventOn: text("event_on").notNull(),
    recordedAt: integer("recorded_at").notNull(),
    recordedByAccountId: text("recorded_by_account_id").$type<AccountId>(),
    requestedByEmployeeId: integer("requested_by_employee_id"),
    sourceType: text("source_type")
      .notNull()
      .$type<"application" | "direct" | "migration" | "system">(),
    sourceApplicationId: integer("source_application_id"),
    correctsActionId: text("corrects_action_id"),
    operationId: text("operation_id").notNull().unique(),
    payloadFingerprint: text("payload_fingerprint").notNull(),
    summaryJson: text("summary_json").notNull(),
  },
  (table) => [
    uniqueIndex("uq_personnel_actions_source_application")
      .on(table.sourceApplicationId)
      .where(sql`source_application_id IS NOT NULL`),
    uniqueIndex("uq_personnel_actions_correction")
      .on(table.correctsActionId)
      .where(sql`corrects_action_id IS NOT NULL`),
    check(
      "personnel_actions_kind",
      sql`${table.kind} IN (
        'hire', 'rehire', 'primary_assignment_started', 'transferred',
        'concurrent_assignment_started', 'assignment_ended', 'position_changed',
        'manager_changed', 'department_responsibility_started',
        'department_responsibility_ended', 'leave_started', 'returned', 'retired',
        'corrected', 'legacy_baseline'
      )`,
    ),
    check(
      "personnel_actions_event_on",
      sql`length(${table.eventOn}) = 10
          AND substr(${table.eventOn}, 5, 1) = '-'
          AND substr(${table.eventOn}, 8, 1) = '-'`,
    ),
    check(
      "personnel_actions_source",
      sql`(${table.sourceType} = 'application' AND ${table.sourceApplicationId} IS NOT NULL)
          OR (${table.sourceType} != 'application' AND ${table.sourceApplicationId} IS NULL)`,
    ),
    check(
      "personnel_actions_correction_target",
      sql`${table.correctsActionId} IS NULL OR ${table.correctsActionId} != ${table.id}`,
    ),
  ],
)

export type PersonnelActionRow = InferSelectModel<typeof personnelActions>

/** 雇用期間の版。最新 revision の非 void 行を現在有効な期間として読む。 */
export const employmentPeriodVersions = sqliteTable(
  "employment_period_versions",
  {
    periodId: text("period_id").notNull(),
    revision: integer("revision").notNull(),
    employeeId: integer("employee_id").notNull(),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on"),
    isVoid: integer("is_void", { mode: "boolean" }).notNull().default(false),
    recordedByActionId: text("recorded_by_action_id").notNull(),
    recordedAt: integer("recorded_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.periodId, table.revision] }),
    check("employment_period_versions_revision", sql`${table.revision} > 0`),
    check(
      "employment_period_versions_range",
      sql`${table.endsOn} IS NULL OR ${table.startsOn} < ${table.endsOn}`,
    ),
  ],
)

export type EmploymentPeriodVersionRow = InferSelectModel<typeof employmentPeriodVersions>

/** 在籍中の状態期間。prehire / retired は雇用期間の有無から導出する。 */
export const employeeStatusPeriodVersions = sqliteTable(
  "employee_status_period_versions",
  {
    periodId: text("period_id").notNull(),
    revision: integer("revision").notNull(),
    employmentPeriodId: text("employment_period_id").notNull(),
    employeeId: integer("employee_id").notNull(),
    status: text("status").notNull().$type<"active" | "leave">(),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on"),
    isVoid: integer("is_void", { mode: "boolean" }).notNull().default(false),
    recordedByActionId: text("recorded_by_action_id").notNull(),
    recordedAt: integer("recorded_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.periodId, table.revision] }),
    check("employee_status_period_versions_revision", sql`${table.revision} > 0`),
    check("employee_status_period_versions_status", sql`${table.status} IN ('active', 'leave')`),
    check(
      "employee_status_period_versions_range",
      sql`${table.endsOn} IS NULL OR ${table.startsOn} < ${table.endsOn}`,
    ),
  ],
)

export type EmployeeStatusPeriodVersionRow = InferSelectModel<typeof employeeStatusPeriodVersions>

/** 主務・兼務の所属期間。上長関係は各所属期間に紐付ける。 */
export const orgAssignmentPeriodVersions = sqliteTable(
  "employee_org_assignment_period_versions",
  {
    periodId: text("period_id").notNull(),
    revision: integer("revision").notNull(),
    employmentPeriodId: text("employment_period_id").notNull(),
    employeeId: integer("employee_id").notNull(),
    departmentCode: text("department_code").notNull(),
    assignmentType: text("assignment_type").notNull().$type<"primary" | "concurrent">(),
    positionTitle: text("position_title"),
    managerEmployeeId: integer("manager_employee_id"),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on"),
    isVoid: integer("is_void", { mode: "boolean" }).notNull().default(false),
    recordedByActionId: text("recorded_by_action_id").notNull(),
    recordedAt: integer("recorded_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.periodId, table.revision] }),
    check("org_assignment_period_versions_revision", sql`${table.revision} > 0`),
    check(
      "org_assignment_period_versions_type",
      sql`${table.assignmentType} IN ('primary', 'concurrent')`,
    ),
    check(
      "org_assignment_period_versions_range",
      sql`${table.endsOn} IS NULL OR ${table.startsOn} < ${table.endsOn}`,
    ),
    check(
      "org_assignment_period_versions_manager",
      sql`${table.managerEmployeeId} IS NULL OR ${table.managerEmployeeId} != ${table.employeeId}`,
    ),
  ],
)

export type OrgAssignmentPeriodVersionRow = InferSelectModel<typeof orgAssignmentPeriodVersions>

/** 部門責任者の期間。組織スコープ判定はこの正本から導出する。 */
export const orgResponsibilityPeriodVersions = sqliteTable(
  "employee_org_responsibility_period_versions",
  {
    periodId: text("period_id").notNull(),
    revision: integer("revision").notNull(),
    departmentCode: text("department_code").notNull(),
    responsibilityType: text("responsibility_type").notNull().$type<"department_manager">(),
    employeeId: integer("employee_id").notNull(),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on"),
    isVoid: integer("is_void", { mode: "boolean" }).notNull().default(false),
    recordedByActionId: text("recorded_by_action_id").notNull(),
    recordedAt: integer("recorded_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.periodId, table.revision] }),
    check("org_responsibility_period_versions_revision", sql`${table.revision} > 0`),
    check(
      "org_responsibility_period_versions_type",
      sql`${table.responsibilityType} = 'department_manager'`,
    ),
    check(
      "org_responsibility_period_versions_range",
      sql`${table.endsOn} IS NULL OR ${table.startsOn} < ${table.endsOn}`,
    ),
  ],
)

export type OrgResponsibilityPeriodVersionRow = InferSelectModel<
  typeof orgResponsibilityPeriodVersions
>

export const employeeLifecycleRevisions = sqliteTable("employee_lifecycle_revisions", {
  employeeId: integer("employee_id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
})

export type EmployeeLifecycleRevisionRow = InferSelectModel<typeof employeeLifecycleRevisions>

export const organizationLifecycleState = sqliteTable(
  "organization_lifecycle_states",
  {
    id: integer("id").primaryKey(),
    revision: integer("revision").notNull().default(0),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    check("organization_lifecycle_state_singleton", sql`${table.id} = 1`),
    check("organization_lifecycle_state_revision", sql`${table.revision} >= 0`),
  ],
)

export type OrganizationLifecycleStateRow = InferSelectModel<typeof organizationLifecycleState>

export const personnelActionRequests = sqliteTable(
  "personnel_action_requests",
  {
    id: text("id").primaryKey(),
    applicationId: integer("application_id").notNull().unique(),
    systemProposalSeriesId: text("system_proposal_series_id").unique(),
    targetEmployeeId: integer("target_employee_id"),
    subjectSnapshotJson: text("subject_snapshot_json"),
    targetDepartmentCode: text("target_department_code"),
    kind: text("kind").notNull().$type<Exclude<PersonnelActionKind, "legacy_baseline">>(),
    payloadJson: text("payload_json").notNull(),
    payloadFingerprint: text("payload_fingerprint"),
    requestedByEmployeeId: integer("requested_by_employee_id").notNull(),
    baseEmployeeRevision: integer("base_employee_revision"),
    baseOrganizationRevision: integer("base_organization_revision"),
    createdAt: integer("created_at").notNull(),
    appliedActionId: text("applied_action_id"),
    withdrawnAt: integer("withdrawn_at"),
    withdrawnByEmployeeId: integer("withdrawn_by_employee_id"),
  },
  (table) => [
    uniqueIndex("uq_personnel_action_requests_applied_action")
      .on(table.appliedActionId)
      .where(sql`applied_action_id IS NOT NULL`),
  ],
)

export type PersonnelActionRequestRow = InferSelectModel<typeof personnelActionRequests>

export const lifecycleMigrationState = sqliteTable("lifecycle_migration_states", {
  id: integer("id").primaryKey(),
  status: text("status").notNull().$type<"pending" | "backfilled" | "verified">(),
  baselineOn: text("baseline_on"),
  companyTimeZone: text("company_time_zone"),
  legacySourceFingerprint: text("legacy_source_fingerprint"),
  employeeCount: integer("employee_count").notNull().default(0),
  departmentCount: integer("department_count").notNull().default(0),
  backfilledAt: integer("backfilled_at"),
  verifiedAt: integer("verified_at"),
})

export type LifecycleMigrationStateRow = InferSelectModel<typeof lifecycleMigrationState>

export const lifecycleOutbox = sqliteTable(
  "lifecycle_outbox_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personnelActionId: text("personnel_action_id").notNull(),
    effectType: text("effect_type").notNull().$type<"hire" | "retired">(),
    payloadJson: text("payload_json").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at").notNull(),
    processedAt: integer("processed_at"),
    lastErrorCode: text("last_error_code"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uq_lifecycle_outbox_action_effect").on(table.personnelActionId, table.effectType),
  ],
)

export type LifecycleOutboxRow = InferSelectModel<typeof lifecycleOutbox>

export const lifecycleEffectTemplateBindings = sqliteTable("lifecycle_effect_template_bindings", {
  effectType: text("effect_type").primaryKey().$type<"hire" | "retired">(),
  templateCode: text("template_code").notNull(),
  updatedAt: integer("updated_at").notNull(),
  updatedByAccountId: text("updated_by_account_id").$type<AccountId>(),
})

export type LifecycleEffectTemplateBindingRow = InferSelectModel<
  typeof lifecycleEffectTemplateBindings
>
