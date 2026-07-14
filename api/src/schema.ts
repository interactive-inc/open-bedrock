import type {
  AccountStatus,
  BatchJobStatus,
  EmployeeStatus,
  ExpenseApprovalAction,
  ExpenseCategory,
  ExpenseStatus,
  IdentityProvider,
  LeaveStatus,
  LeaveType,
  RedemptionStatus,
} from "@/lib/schemas"
import type { PersonnelActionKind } from "@/domain/employee-lifecycle/lifecycle-types"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

// このスキーマは Drizzle ORM のクエリ用の型定義。DB スキーマ（テーブル・インデックス）の正は
// api/migrations/*.sql で、本プロジェクトは手書き migration 運用（drizzle-kit generate による
// 再生成は行わない）。migration が持つ一意インデックス・部分インデックス（二重登録・TOCTOU 防止）
// は、ORM からの可視性とドリフト検知のため schema.ts にも宣言して同期させている（性能用の
// 非一意インデックスは除く）。インデックスを追加・変更する際は migration を正として更新し、
// 一意・部分インデックスは本ファイルにも反映すること。

// 従業員台帳(純台帳)。認証(email/password)は identities、認可(role)は account_roles が正。
export const employees = sqliteTable("employees", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  deptId: integer("dept_id"),
  deptName: text("dept_name"),
  position: text("position"),
  status: text("status").notNull().$type<EmployeeStatus>(),
  archivedAt: integer("archived_at"),
  archivedByAccountId: integer("archived_by_account_id"),
})

export type EmployeeRow = InferSelectModel<typeof employees>

// 部署マスタ（id と表示名）
export const departments = sqliteTable("departments", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
})

export type DepartmentRow = InferSelectModel<typeof departments>

// 組織図上の部署ノード
export const orgDepartments = sqliteTable("org_departments", {
  code: text("code").primaryKey(),
  departmentId: integer("department_id").notNull(),
  parentCode: text("parent_code"),
  managerEmployeeCode: text("manager_employee_code"),
  sortOrder: integer("sort_order").notNull(),
  archivedAt: integer("archived_at"),
  archivedByAccountId: integer("archived_by_account_id"),
})

export type OrgDepartmentRow = InferSelectModel<typeof orgDepartments>

// 部署への所属
export const orgMemberships = sqliteTable(
  "org_memberships",
  {
    departmentCode: text("department_code").notNull(),
    employeeCode: text("employee_code").notNull(),
    managerEmployeeCode: text("manager_employee_code"),
  },
  (table) => [primaryKey({ columns: [table.departmentCode, table.employeeCode] })],
)

export type OrgMembershipRow = InferSelectModel<typeof orgMemberships>

// 通知（社員宛ての申請・承認・リマインド・お知らせ）。is_read は 0/1 で保存する。
export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recipientEmployeeId: integer("recipient_employee_id").notNull(),
    sourceDomain: text("source_domain").notNull(),
    sourceId: integer("source_id"),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    isRead: integer("is_read").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_notifications_recipient_unread")
      .on(table.recipientEmployeeId)
      .where(sql`is_read = 0`),
  ],
)

export type NotificationRow = InferSelectModel<typeof notifications>

// 研修コース（コード・タイトル・カテゴリ・必須フラグ・状態）。is_required は 0/1 を boolean で持つ。
export const trainingCourses = sqliteTable("training_courses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  durationMinutes: integer("duration_minutes"),
  category: text("category").notNull(),
  isRequired: integer("is_required", { mode: "boolean" }).notNull(),
  status: text("status").notNull(),
})

export type TrainingCourseRow = InferSelectModel<typeof trainingCourses>

// 受講登録（社員ごとのコース受講状況・スコア・期限）。
export const trainingEnrollments = sqliteTable(
  "training_enrollments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    courseId: integer("course_id").notNull(),
    employeeId: integer("employee_id").notNull(),
    status: text("status").notNull(),
    completedAt: text("completed_at"),
    score: integer("score"),
    dueDate: text("due_date"),
  },
  // 同一コース・同一社員の受講登録は 1 件まで（重複受講を防ぐ）。
  (table) => [
    uniqueIndex("idx_training_enrollments_course_employee").on(table.courseId, table.employeeId),
  ],
)

export type TrainingEnrollmentRow = InferSelectModel<typeof trainingEnrollments>

// 評価サイクル（多面評価の実施単位・期間・状態）
export const reviewCycles = sqliteTable("review_cycles", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  period: text("period").notNull(),
  status: text("status").notNull(),
  dueDate: text("due_date"),
})

export type ReviewCycleRow = InferSelectModel<typeof reviewCycles>

// 評価フォーム（サイクル・被評価者・評価者ごとの回答とスコア・状態）。answers は JSON 文字列で保存される。
export const reviewForms = sqliteTable("review_forms", {
  id: integer("id").primaryKey(),
  cycleId: integer("cycle_id").notNull(),
  subjectEmployeeId: integer("subject_employee_id").notNull(),
  reviewerEmployeeId: integer("reviewer_employee_id").notNull(),
  reviewerType: text("reviewer_type").notNull(),
  answers: text("answers").notNull(),
  score: integer("score"),
  comment: text("comment"),
  status: text("status").notNull(),
  submittedAt: text("submitted_at"),
})

export type ReviewFormRow = InferSelectModel<typeof reviewForms>

export const reviewCyclePolicies = sqliteTable("review_cycle_policies", {
  cycleId: integer("cycle_id").primaryKey(),
  policyJson: text("policy_json").notNull(),
})

export type ReviewCyclePolicyRow = InferSelectModel<typeof reviewCyclePolicies>

// 給与明細（社員ごと・期間ごとの支給/控除/差引支給額）
export const payslips = sqliteTable(
  "payslips",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull(),
    period: text("period").notNull(),
    baseSalary: integer("base_salary").notNull(),
    allowances: integer("allowances").notNull(),
    deductions: integer("deductions").notNull(),
    netPay: integer("net_pay").notNull(),
    issuedAt: text("issued_at"),
    status: text("status").notNull(),
  },
  // 同一社員・同一期間の二重発行を禁止する。
  (table) => [uniqueIndex("uq_payslips_employee_period").on(table.employeeId, table.period)],
)

export type PayslipRow = InferSelectModel<typeof payslips>

// 給与改定の履歴（基本給の改定・前回基本給・適用日）
export const salaryRevisions = sqliteTable(
  "salary_revisions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull(),
    effectiveDate: text("effective_date").notNull(),
    previousBaseSalary: integer("previous_base_salary").notNull(),
    newBaseSalary: integer("new_base_salary").notNull(),
    reason: text("reason"),
    createdAt: text("created_at").notNull(),
  },
  // 同一社員・同一適用日の給与改定は 1 件まで（二重登録を防ぐ）。
  (table) => [
    uniqueIndex("uq_salary_revisions_employee_date").on(table.employeeId, table.effectiveDate),
  ],
)

export type SalaryRevisionRow = InferSelectModel<typeof salaryRevisions>

// シフトパターン（勤務区分の雛形：勤務時間と休憩）
export const shiftPatterns = sqliteTable("shift_patterns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  breakMinutes: integer("break_minutes").notNull(),
})

export type ShiftPatternRow = InferSelectModel<typeof shiftPatterns>

// シフト割当（社員ごとの日次シフト。published_at:null は下書き）
export const shiftAssignments = sqliteTable(
  "shift_assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull(),
    patternId: integer("pattern_id"),
    date: text("date").notNull(),
    note: text("note"),
    publishedAt: text("published_at"),
  },
  (table) => [
    index("idx_shift_assignments_pattern").on(table.patternId),
    uniqueIndex("uq_shift_assignment_employee_date").on(table.employeeId, table.date),
  ],
)

export type ShiftAssignmentRow = InferSelectModel<typeof shiftAssignments>

// シフト交代申請（申請者と交代相手・対象日・承認状態）
export const shiftSwapRequests = sqliteTable(
  "shift_swap_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requesterEmployeeId: integer("requester_employee_id").notNull(),
    targetEmployeeId: integer("target_employee_id").notNull(),
    date: text("date").notNull(),
    note: text("note"),
    status: text("status").notNull(),
    approvedAt: text("approved_at"),
  },
  // 同一の依頼者・対象者・日付で pending の交代申請は 1 件まで（二重申請を防ぐ）。
  (table) => [
    uniqueIndex("idx_shift_swap_requests_pending")
      .on(table.requesterEmployeeId, table.targetEmployeeId, table.date)
      .where(sql`status = 'pending'`),
  ],
)

export type ShiftSwapRequestRow = InferSelectModel<typeof shiftSwapRequests>

// 休暇申請（本人の申請・承認/却下の記録）。id は自動採番。
export const leaveRequests = sqliteTable("leave_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull(),
  leaveType: text("leave_type").notNull().$type<LeaveType>(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  days: integer("days").notNull(),
  reason: text("reason"),
  status: text("status").notNull().$type<LeaveStatus>(),
  approverId: integer("approver_id"),
  decidedComment: text("decided_comment"),
  createdAt: text("created_at").notNull(),
})

export type LeaveRequestRow = InferSelectModel<typeof leaveRequests>

// 年度ごとの休暇残数（付与・消化・残）。employee_id + fiscal_year + leave_type が主キー。
export const leaveBalances = sqliteTable(
  "leave_balances",
  {
    employeeId: integer("employee_id").notNull(),
    fiscalYear: text("fiscal_year").notNull(),
    leaveType: text("leave_type").notNull().$type<LeaveType>(),
    grantedDays: integer("granted_days").notNull(),
    usedDays: integer("used_days").notNull(),
    remainingDays: integer("remaining_days").notNull(),
  },
  (table) => [primaryKey({ columns: [table.employeeId, table.fiscalYear, table.leaveType] })],
)

export type LeaveBalanceRow = InferSelectModel<typeof leaveBalances>

// 入社/退職手続きのテンプレート（チェックリストの雛形）
export const onboardingTemplates = sqliteTable("onboarding_templates", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  description: text("description"),
})

export type OnboardingTemplateRow = InferSelectModel<typeof onboardingTemplates>

// テンプレートに含まれるタスク定義（並び順・担当ロール）
export const onboardingTemplateTasks = sqliteTable(
  "onboarding_template_tasks",
  {
    templateCode: text("template_code").notNull(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    sortOrder: integer("sort_order").notNull(),
    ownerRole: text("owner_role"),
  },
  (table) => [primaryKey({ columns: [table.templateCode, table.code] })],
)

export type OnboardingTemplateTaskRow = InferSelectModel<typeof onboardingTemplateTasks>

// 社員へのテンプレート割り当て（手続きの進行状態）
export const onboardingAssignments = sqliteTable(
  "onboarding_assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull(),
    templateCode: text("template_code").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    assignedAt: text("assigned_at").notNull(),
  },
  // 同一社員・同一テンプレートで未完了の割当は 1 件まで（重複割当を防ぐ）。
  (table) => [
    uniqueIndex("uq_onboarding_assignments_employee_template")
      .on(table.employeeId, table.templateCode)
      .where(sql`status != 'completed'`),
  ],
)

export type OnboardingAssignmentRow = InferSelectModel<typeof onboardingAssignments>

// 割り当てから展開された個別タスク（完了状態）
export const onboardingTasks = sqliteTable("onboarding_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assignmentId: integer("assignment_id").notNull(),
  templateTaskCode: text("template_task_code").notNull(),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull(),
  status: text("status").notNull(),
  completedAt: text("completed_at"),
})

export type OnboardingTaskRow = InferSelectModel<typeof onboardingTasks>

// 申請テンプレート（種類・カテゴリ・入力スキーマ・承認ロール）。
// schema_json と approver_roles は JSON 文字列で保存される。
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

// 申請（テンプレートに紐づく申請者の提出）。payload は JSON 文字列で保存される。
export const applications = sqliteTable(
  "applications",
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

// 申請への承認/却下アクションの記録。
export const applicationApprovals = sqliteTable("application_approvals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id").notNull(),
  approverId: integer("approver_id").notNull(),
  action: text("action").notNull(),
  comment: text("comment"),
  createdAt: text("created_at").notNull(),
})

export type ApplicationApprovalRow = InferSelectModel<typeof applicationApprovals>

// 人事アクション台帳。事実は追記のみで、訂正も corrected アクションとして記録する。
export const personnelActions = sqliteTable(
  "personnel_actions",
  {
    id: text("id").primaryKey(),
    employeeId: integer("employee_id").notNull(),
    kind: text("kind").notNull().$type<PersonnelActionKind>(),
    eventOn: text("event_on").notNull(),
    recordedAt: integer("recorded_at").notNull(),
    recordedByAccountId: integer("recorded_by_account_id"),
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

// 雇用期間の版。最新 revision の非 void 行を現在有効な期間として読む。
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

// 在籍中の状態期間。prehire / retired は雇用期間の有無から導出する。
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

// 主務・兼務の所属期間。上長関係は各所属期間に紐付ける。
export const orgAssignmentPeriodVersions = sqliteTable(
  "org_assignment_period_versions",
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

// 部門責任者の期間。組織スコープ判定はこの正本から導出する。
export const orgResponsibilityPeriodVersions = sqliteTable(
  "org_responsibility_period_versions",
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

export const organizationLifecycleState = sqliteTable("organization_lifecycle_state", {
  id: integer("id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
})

export type OrganizationLifecycleStateRow = InferSelectModel<typeof organizationLifecycleState>

export const personnelActionRequests = sqliteTable(
  "personnel_action_requests",
  {
    id: text("id").primaryKey(),
    applicationId: integer("application_id").notNull().unique(),
    targetEmployeeId: integer("target_employee_id"),
    kind: text("kind").notNull().$type<Exclude<PersonnelActionKind, "legacy_baseline">>(),
    payloadJson: text("payload_json").notNull(),
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

export const lifecycleMigrationState = sqliteTable("lifecycle_migration_state", {
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
  "lifecycle_outbox",
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
  updatedByAccountId: integer("updated_by_account_id"),
})

export type LifecycleEffectTemplateBindingRow = InferSelectModel<
  typeof lifecycleEffectTemplateBindings
>

export const applicationWorkflows = sqliteTable("application_workflows", {
  templateId: integer("template_id").primaryKey(),
  definitionJson: text("definition_json").notNull(),
  updatedAt: text("updated_at").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedByAccountId: integer("updated_by_account_id"),
})

export type ApplicationWorkflowRow = InferSelectModel<typeof applicationWorkflows>

export const applicationWorkflowRevisions = sqliteTable(
  "application_workflow_revisions",
  {
    templateId: integer("template_id").notNull(),
    revision: integer("revision").notNull(),
    definitionJson: text("definition_json").notNull(),
    updatedByAccountId: integer("updated_by_account_id"),
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
    candidateAccountId: integer("candidate_account_id").notNull(),
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
    approverAccountId: integer("approver_account_id"),
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
    actorAccountId: integer("actor_account_id"),
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
  createdByAccountId: integer("created_by_account_id"),
  cancelledAt: text("cancelled_at"),
  createdAt: text("created_at").notNull(),
})

export type ApprovalDelegationRow = InferSelectModel<typeof approvalDelegations>

// 資産台帳（asset ドメイン）。code がPK。在庫/貸出/廃棄状態と保有者を持つ。
export const assets = sqliteTable("assets", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  serial: text("serial"),
  purchasedOn: text("purchased_on"),
  status: text("status").notNull(),
  holderEmployeeId: integer("holder_employee_id"),
  disposedOn: text("disposed_on"),
  disposalReason: text("disposal_reason"),
})

export type AssetRow = InferSelectModel<typeof assets>

// 貸出記録。open は returned_at が NULL。返却で閉じる。
export const assetLendings = sqliteTable("asset_lendings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetCode: text("asset_code").notNull(),
  employeeId: integer("employee_id").notNull(),
  lentAt: text("lent_at").notNull(),
  returnedAt: text("returned_at"),
})

export type AssetLendingRow = InferSelectModel<typeof assetLendings>

// 棚卸しセッション（stocktake ドメイン）。open→closed の状態を持つ。
export const stocktakes = sqliteTable(
  "stocktakes",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    targetDate: text("target_date").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    closedAt: text("closed_at"),
  },
  (table) => [index("idx_stocktakes_status").on(table.status)],
)

export type StocktakeRow = InferSelectModel<typeof stocktakes>

// 棚卸しセッションでの資産ごとの現物確認記録。checked_at:null は未確認。
export const stocktakeItems = sqliteTable(
  "stocktake_items",
  {
    stocktakeId: text("stocktake_id").notNull(),
    assetCode: text("asset_code").notNull(),
    checkedAt: text("checked_at"),
    checkerEmployeeId: integer("checker_employee_id"),
    locationNote: text("location_note"),
  },
  (table) => [primaryKey({ columns: [table.stocktakeId, table.assetCode] })],
)

export type StocktakeItemRow = InferSelectModel<typeof stocktakeItems>

// 勤怠記録（出勤・退勤の打刻と労働時間）。id は AUTOINCREMENT。
export const attendanceRecords = sqliteTable(
  "attendance_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull(),
    workDate: text("work_date").notNull(),
    clockInAt: text("clock_in_at"),
    clockOutAt: text("clock_out_at"),
    workMinutes: integer("work_minutes"),
    note: text("note"),
    status: text("status").notNull(),
  },
  // 打刻中(open)は 1 社員 1 件まで。clock-in の二重実行を DB レベルで弾く（TOCTOU 防止）。
  (table) => [
    uniqueIndex("idx_attendance_records_employee_open_unique")
      .on(table.employeeId)
      .where(sql`status = 'open'`),
  ],
)

export type AttendanceRecordRow = InferSelectModel<typeof attendanceRecords>

// バッチジョブの実行状況（夜間同期・通知送信などの記録）。
export const batchJobs = sqliteTable("batch_jobs", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().$type<BatchJobStatus>(),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  message: text("message"),
})

export type BatchJobRow = InferSelectModel<typeof batchJobs>

// 社内公募（部署・必要スキル・公開状態）。
export const careerPostings = sqliteTable("career_postings", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  deptId: integer("dept_id"),
  deptName: text("dept_name"),
  requiredSkills: text("required_skills"),
  status: text("status").notNull(),
})

export type CareerPostingRow = InferSelectModel<typeof careerPostings>

// 公募への応募（応募者・メッセージ・状態）。id は AUTOINCREMENT。
export const careerApplications = sqliteTable(
  "career_applications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postingId: integer("posting_id").notNull(),
    applicantId: integer("applicant_id").notNull(),
    message: text("message"),
    status: text("status").notNull(),
  },
  // 同一公募への重複応募を防ぐ。
  (table) => [
    uniqueIndex("idx_career_applications_posting_applicant").on(table.postingId, table.applicantId),
  ],
)

export type CareerApplicationRow = InferSelectModel<typeof careerApplications>

// 社員ごとのキャリアシート（目標・強み）。employee_id が主キー。
export const careerSheets = sqliteTable("career_sheets", {
  employeeId: integer("employee_id").primaryKey(),
  goalsText: text("goals_text"),
  strengthsText: text("strengths_text"),
  updatedAt: text("updated_at").notNull(),
})

export type CareerSheetRow = InferSelectModel<typeof careerSheets>

// 経費申請（申請者・カテゴリ・金額・ステータス）。
export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull(),
  category: text("category").notNull().$type<ExpenseCategory>(),
  amount: integer("amount").notNull(),
  spentAt: text("spent_at").notNull(),
  note: text("note"),
  status: text("status").notNull().$type<ExpenseStatus>(),
  createdAt: text("created_at").notNull(),
})

export type ExpenseRow = InferSelectModel<typeof expenses>

// 経費への承認/却下アクションの記録。
export const expenseApprovals = sqliteTable("expense_approvals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expenseId: integer("expense_id").notNull(),
  approverId: integer("approver_id").notNull(),
  action: text("action").notNull().$type<ExpenseApprovalAction>(),
  comment: text("comment"),
  createdAt: text("created_at").notNull(),
})

export type ExpenseApprovalRow = InferSelectModel<typeof expenseApprovals>

// 部署予算（部署・会計期間・金額の記録）。消化額は保持せず、承認済み経費の読み取り集計で算出する。
export const budgets = sqliteTable("budgets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  departmentId: integer("department_id").notNull(),
  fiscalPeriod: text("fiscal_period").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  amount: integer("amount").notNull(),
  name: text("name").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
})

export type BudgetRow = InferSelectModel<typeof budgets>

// 機能フラグ（core / optional）。1機能 = 1行。表示順を sort_order で保持する。
// is_core は必須機能か、is_enabled は有効かを 0/1 で持つ。
// 目標（社員ごと・評価期間ごとの目標と重み・状態）
export const goals = sqliteTable("goals", {
  id: integer("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  period: text("period").notNull(),
  title: text("title").notNull(),
  kpi: text("kpi"),
  weight: integer("weight").notNull(),
  status: text("status").notNull(),
})

export type GoalRow = InferSelectModel<typeof goals>

// 目標への評価（自己・上長・最終）
export const goalEvaluations = sqliteTable(
  "goal_evaluations",
  {
    id: integer("id").primaryKey(),
    goalId: integer("goal_id").notNull(),
    evaluatorId: integer("evaluator_id").notNull(),
    kind: text("kind").notNull(),
    score: integer("score"),
    comment: text("comment"),
    createdAt: text("created_at").notNull(),
  },
  // 1 目標につき final 評価は 1 件まで（最終評価の二重登録を防ぐ）。
  // self / manager は 1 目標・1 評価者・1 種別につき 1 件まで。
  (table) => [
    uniqueIndex("idx_goal_evaluations_goal_final")
      .on(table.goalId)
      .where(sql`kind = 'final'`),
    uniqueIndex("idx_goal_evaluations_evaluator_kind")
      .on(table.goalId, table.evaluatorId, table.kind)
      .where(sql`kind IN ('self', 'manager')`),
  ],
)

export type GoalEvaluationRow = InferSelectModel<typeof goalEvaluations>

// ナレッジ記事（社内手続き・規程などの記事）
export const knowledgeArticles = sqliteTable("knowledge_articles", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  tags: text("tags"),
  bodyMd: text("body_md").notNull(),
  authorId: integer("author_id").notNull(),
  createdAt: text("created_at").notNull(),
})

export type KnowledgeArticleRow = InferSelectModel<typeof knowledgeArticles>

// 1on1 の記録（参加者・実施日時・話題・所感・次アクション）。
export const oneOnOnes = sqliteTable("one_on_ones", {
  id: text("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  managerId: integer("manager_id").notNull(),
  heldAt: text("held_at").notNull(),
  topics: text("topics"),
  managerNote: text("manager_note"),
  nextAction: text("next_action"),
})

export type OneOnOneRow = InferSelectModel<typeof oneOnOnes>

// 感謝（サンクス）。送り手が受け手へ送る感謝メッセージ。points は将来のポイント付与用で本 Task では常に 0。
export const thanks = sqliteTable("thanks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  senderEmployeeId: integer("sender_employee_id").notNull(),
  recipientEmployeeId: integer("recipient_employee_id").notNull(),
  message: text("message").notNull(),
  points: integer("points").notNull().default(0),
  createdAt: text("created_at").notNull(),
})

export type ThanksRow = InferSelectModel<typeof thanks>

// サンクスポイントの月次贈与原資。employee_id + period(YYYY-MM) で一意。
// 残量は granted_points − consumed_points で算出する。consumed_points は贈与時に
// 原子的な条件付き UPDATE で加算し、同月の同時送付でも原資超過しないための消費カウンタ。
export const thanksPointBudgets = sqliteTable(
  "thanks_point_budgets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull(),
    period: text("period").notNull(),
    grantedPoints: integer("granted_points").notNull(),
    consumedPoints: integer("consumed_points").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uq_thanks_point_budgets_employee_period").on(table.employeeId, table.period),
  ],
)

export type ThanksPointBudgetRow = InferSelectModel<typeof thanksPointBudgets>

// サンクスポイントの交換カタログ。stock が null は在庫無制限。is_active は 0/1 を boolean で持つ。
export const thanksRewards = sqliteTable("thanks_rewards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  pointCost: integer("point_cost").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull(),
  stock: integer("stock"),
  createdAt: text("created_at").notNull(),
})

export type ThanksRewardRow = InferSelectModel<typeof thanksRewards>

// サンクスポイントの交換申請。状態は pending→fulfilled（確定）/rejected（却下）。
// point_cost は申請時点の交換コストを写し取り、後からカタログ価格が変わってもブレないようにする。
export const thanksRedemptions = sqliteTable(
  "thanks_redemptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull(),
    rewardId: integer("reward_id").notNull(),
    pointCost: integer("point_cost").notNull(),
    status: text("status").notNull().$type<RedemptionStatus>(),
    createdAt: text("created_at").notNull(),
    decidedAt: text("decided_at"),
    deciderId: integer("decider_id"),
  },
  // 1 社員につき pending の交換申請は 1 件まで（二重申請・残高の二重引当を防ぐ）。
  (table) => [
    uniqueIndex("idx_thanks_redemptions_employee_pending")
      .on(table.employeeId)
      .where(sql`status = 'pending'`),
  ],
)

export type ThanksRedemptionRow = InferSelectModel<typeof thanksRedemptions>

// 会議室マスタ（定員・所在地）
export const rooms = sqliteTable("rooms", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull(),
  location: text("location"),
})

export type RoomRow = InferSelectModel<typeof rooms>

// 会議室予約（重複判定は start_at/end_at の範囲で行う）
export const roomReservations = sqliteTable(
  "room_reservations",
  {
    id: text("id").primaryKey(),
    roomId: integer("room_id").notNull(),
    reserverId: integer("reserver_id").notNull(),
    startAt: text("start_at").notNull(),
    endAt: text("end_at").notNull(),
    purpose: text("purpose"),
  },
  (table) => [
    index("idx_room_reservations_reserver").on(table.reserverId),
    index("idx_room_reservations_overlap").on(table.roomId, table.startAt, table.endAt),
  ],
)

export type RoomReservationRow = InferSelectModel<typeof roomReservations>

// スキルマスタ（コード・表示名・カテゴリ）
export const skills = sqliteTable("skills", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
})

export type SkillRow = InferSelectModel<typeof skills>

// 従業員ごとの登録スキル（レベル・経験年数・補足）
export const employeeSkills = sqliteTable(
  "employee_skills",
  {
    employeeId: integer("employee_id").notNull(),
    skillCode: text("skill_code").notNull(),
    level: integer("level").notNull(),
    years: integer("years"),
    note: text("note"),
  },
  (table) => [primaryKey({ columns: [table.employeeId, table.skillCode] })],
)

export type EmployeeSkillRow = InferSelectModel<typeof employeeSkills>

// アンケート（survey ドメイン）。questions_json は設問定義の JSON 文字列。
export const surveys = sqliteTable("surveys", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status").notNull(),
  questionsJson: text("questions_json").notNull(),
})

export type SurveyRow = InferSelectModel<typeof surveys>

// アンケートへの回答。id は自動採番。answers_json は回答内容の JSON 文字列。
export const surveyResponses = sqliteTable(
  "survey_responses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    surveyId: integer("survey_id").notNull(),
    respondentId: integer("respondent_id").notNull(),
    answersJson: text("answers_json").notNull(),
    submittedAt: text("submitted_at").notNull(),
  },
  // 1 アンケートにつき 1 回答者 1 件まで（二重回答を防ぐ）。
  (table) => [
    uniqueIndex("idx_survey_responses_survey_respondent").on(table.surveyId, table.respondentId),
  ],
)

export type SurveyResponseRow = InferSelectModel<typeof surveyResponses>

// 出張申請（行き先・期間・目的・概算費用の記録。金額の計算や判定は持たず記録のみ）
export const businessTrips = sqliteTable("business_trips", {
  id: text("id").primaryKey(),
  travelerId: integer("traveler_id").notNull(),
  destination: text("destination").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  purpose: text("purpose").notNull(),
  estimatedCost: integer("estimated_cost"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
})

export type BusinessTripRow = InferSelectModel<typeof businessTrips>

// 物のレンタル予約（外部からの貸与品の予約申請。期間と用途を記録）
export const rentalReservations = sqliteTable("rental_reservations", {
  id: text("id").primaryKey(),
  requesterId: integer("requester_id").notNull(),
  itemName: text("item_name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  purpose: text("purpose"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
})

export type RentalReservationRow = InferSelectModel<typeof rentalReservations>

// 退職申請（申出の受付から書類交付までの記録。法的判定は持たず記録のみ）
export const resignations = sqliteTable(
  "resignations",
  {
    id: text("id").primaryKey(),
    employeeId: integer("employee_id").notNull(),
    resignationDate: text("resignation_date").notNull(),
    lastWorkingDate: text("last_working_date"),
    reason: text("reason"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  // 1 社員につき requested の退職申請は 1 件まで（二重申請を防ぐ）。
  (table) => [
    uniqueIndex("idx_resignations_employee_requested")
      .on(table.employeeId)
      .where(sql`status = 'requested'`),
  ],
)

export type ResignationRow = InferSelectModel<typeof resignations>

// ライフイベント届出（結婚・出産・転居・忌引・扶養変更などの届出を記録）
export const lifeEvents = sqliteTable("life_events", {
  id: text("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  eventType: text("event_type").notNull(),
  eventDate: text("event_date").notNull(),
  detail: text("detail"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
})

export type LifeEventRow = InferSelectModel<typeof lifeEvents>

// 産休・育休・介護休業の申出（期限管理と記録。給付金額の計算は持たない）
export const familyCareLeaves = sqliteTable("family_care_leaves", {
  id: text("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  leaveKind: text("leave_kind").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  note: text("note"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
})

export type FamilyCareLeaveRow = InferSelectModel<typeof familyCareLeaves>

// 証明書発行依頼（在職・就労・退職証明書などの発行依頼を記録）
export const certificateRequests = sqliteTable("certificate_requests", {
  id: text("id").primaryKey(),
  requesterId: integer("requester_id").notNull(),
  certificateType: text("certificate_type").notNull(),
  submitTo: text("submit_to"),
  neededBy: text("needed_by"),
  note: text("note"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
})

export type CertificateRequestRow = InferSelectModel<typeof certificateRequests>

// 年末調整の申告受付（提出状況の記録のみ。税額の計算や判定は持たない）
export const yearEndAdjustments = sqliteTable(
  "year_end_adjustments",
  {
    id: text("id").primaryKey(),
    employeeId: integer("employee_id").notNull(),
    targetYear: integer("target_year").notNull(),
    note: text("note"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  // 同一社員・同一年度の二重申告を禁止する。
  (table) => [uniqueIndex("uq_yea_employee_year").on(table.employeeId, table.targetYear)],
)

export type YearEndAdjustmentRow = InferSelectModel<typeof yearEndAdjustments>

// 反社チェックの申請（取引先の確認情報と判定結果を記録）
export const antisocialChecks = sqliteTable("antisocial_checks", {
  id: text("id").primaryKey(),
  requesterId: integer("requester_id").notNull(),
  partnerName: text("partner_name").notNull(),
  partnerAddress: text("partner_address"),
  representativeName: text("representative_name"),
  result: text("result"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
})

export type AntisocialCheckRow = InferSelectModel<typeof antisocialChecks>

// drizzle(c.env.DB, { schema }) と c.var.database の型に渡すための集約。
// IAM: 認証主体。従業員台帳から分離。employee_id は論理参照(null 可)。
export const accounts = sqliteTable(
  "accounts",
  {
    id: integer("id").primaryKey(),
    employeeId: integer("employee_id"),
    status: text("status").notNull().$type<AccountStatus>(),
    tokenVersion: integer("token_version").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("uniq_accounts_employee")
      .on(table.employeeId)
      .where(sql`employee_id IS NOT NULL`),
  ],
)

export type AccountRow = InferSelectModel<typeof accounts>

// IAM: ログイン手段(多態)。password は secret に PBKDF2、OAuth は subject に sub。
export const identities = sqliteTable(
  "identities",
  {
    id: integer("id").primaryKey(),
    accountId: integer("account_id").notNull(),
    provider: text("provider").notNull().$type<IdentityProvider>(),
    subject: text("subject").notNull(),
    secret: text("secret"),
    email: text("email"),
    emailVerified: integer("email_verified").notNull().default(0),
    lastUsedAt: integer("last_used_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uniq_identities_provider_subject").on(table.provider, table.subject),
    index("idx_identities_account").on(table.accountId),
  ],
)

export type IdentityRow = InferSelectModel<typeof identities>

// IAM: ロール。system role は is_system=1 で key 改名・削除不可。
export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: integer("is_system").notNull().default(0),
  createdAt: integer("created_at").notNull(),
})

export type RoleRow = InferSelectModel<typeof roles>

// IAM: 権限カタログ(UI 用の写し、正はコードの PERMISSION_KEYS)。
export const permissions = sqliteTable("permissions", {
  id: integer("id").primaryKey(),
  key: text("key").notNull().unique(),
  description: text("description").notNull(),
  category: text("category").notNull(),
})

export type PermissionRow = InferSelectModel<typeof permissions>

// IAM: ロールが持つ権限。
export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    roleId: integer("role_id").notNull(),
    permissionId: integer("permission_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
)

export type RolePermissionRow = InferSelectModel<typeof rolePermissions>

// IAM: アカウントに割り当てたロール。複数可、実効権限は和集合。
export const accountRoles = sqliteTable(
  "account_roles",
  {
    accountId: integer("account_id").notNull(),
    roleId: integer("role_id").notNull(),
    grantedBy: integer("granted_by"),
    grantedAt: integer("granted_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.roleId] })],
)

export type AccountRoleRow = InferSelectModel<typeof accountRoles>

// IAM: refresh token。生は保存せず SHA-256 のみ。family_id で再利用検知。
export const refreshTokens = sqliteTable(
  "refresh_tokens",
  {
    id: integer("id").primaryKey(),
    accountId: integer("account_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    familyId: text("family_id").notNull(),
    tokenVersion: integer("token_version").notNull().default(0),
    expiresAt: integer("expires_at").notNull(),
    revokedAt: integer("revoked_at"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_refresh_tokens_account").on(table.accountId),
    index("idx_refresh_tokens_active_family")
      .on(table.familyId)
      .where(sql`revoked_at IS NULL`),
  ],
)

export type RefreshTokenRow = InferSelectModel<typeof refreshTokens>

// IAM: 監査イベント(append-only)。UPDATE/DELETE は DB trigger でも禁止する。
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey(),
    eventId: text("event_id").notNull().unique(),
    requestId: text("request_id").notNull(),
    actorAccountId: integer("actor_account_id"),
    actorEmployeeId: integer("actor_employee_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    outcome: text("outcome").notNull().$type<"succeeded" | "denied" | "failed">(),
    reasonCode: text("reason_code"),
    authorizationJson: text("authorization_json"),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    metadataJson: text("metadata_json"),
    clientIp: text("client_ip"),
    clientName: text("client_name").notNull().$type<"web" | "cli" | "api" | "system">(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_audit_logs_request").on(table.requestId),
    index("idx_audit_logs_actor").on(table.actorAccountId, table.createdAt, table.id),
    index("idx_audit_logs_actor_employee").on(table.actorEmployeeId, table.createdAt, table.id),
    index("idx_audit_logs_action").on(table.action, table.createdAt, table.id),
    index("idx_audit_logs_target").on(table.targetType, table.targetId, table.createdAt, table.id),
    index("idx_audit_logs_outcome").on(table.outcome, table.createdAt, table.id),
    index("idx_audit_logs_created").on(table.createdAt, table.id),
  ],
)

export type AuditLogRow = InferSelectModel<typeof auditLogs>

// 監査付き batch の transaction 内だけで使う排他的 decision marker。
export const auditBatchDecisions = sqliteTable(
  "audit_batch_decisions",
  {
    decisionId: text("decision_id").primaryKey(),
    decisionValue: text("decision_value").notNull(),
  },
  (table) => [
    check(
      "audit_batch_decisions_decision_id_length",
      sql`length(${table.decisionId}) BETWEEN 1 AND 200`,
    ),
    check(
      "audit_batch_decisions_decision_value_length",
      sql`length(${table.decisionValue}) BETWEEN 1 AND 64`,
    ),
  ],
)

export type AuditBatchDecisionRow = InferSelectModel<typeof auditBatchDecisions>

export const schema = {
  accounts,
  identities,
  roles,
  permissions,
  rolePermissions,
  accountRoles,
  refreshTokens,
  auditLogs,
  auditBatchDecisions,
  employees,
  departments,
  orgDepartments,
  orgMemberships,
  notifications,
  trainingCourses,
  trainingEnrollments,
  reviewCycles,
  reviewForms,
  payslips,
  salaryRevisions,
  shiftPatterns,
  shiftAssignments,
  shiftSwapRequests,
  leaveRequests,
  leaveBalances,
  onboardingTemplates,
  onboardingTemplateTasks,
  onboardingAssignments,
  onboardingTasks,
  applicationTemplates,
  applications,
  applicationApprovals,
  personnelActions,
  employmentPeriodVersions,
  employeeStatusPeriodVersions,
  orgAssignmentPeriodVersions,
  orgResponsibilityPeriodVersions,
  employeeLifecycleRevisions,
  organizationLifecycleState,
  personnelActionRequests,
  applicationSubjects,
  applicationCompletionBindings,
  lifecycleMigrationState,
  lifecycleOutbox,
  lifecycleEffectTemplateBindings,
  assets,
  assetLendings,
  stocktakes,
  stocktakeItems,
  attendanceRecords,
  batchJobs,
  careerPostings,
  careerApplications,
  careerSheets,
  expenses,
  expenseApprovals,
  budgets,
  goals,
  goalEvaluations,
  knowledgeArticles,
  oneOnOnes,
  thanks,
  thanksPointBudgets,
  thanksRewards,
  thanksRedemptions,
  rooms,
  roomReservations,
  skills,
  employeeSkills,
  surveys,
  surveyResponses,
  businessTrips,
  rentalReservations,
  resignations,
  lifeEvents,
  familyCareLeaves,
  certificateRequests,
  yearEndAdjustments,
  antisocialChecks,
}
