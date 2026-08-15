import type {
  CalendarDayKind,
  ExpenseApprovalAction,
  ExpenseCategory,
  ExpenseStatus,
  LeaveStatus,
  LeaveType,
  LeaveUnit,
  LifeEventType,
  RedemptionStatus,
  RingiStatus,
  WorkStyle,
} from "@/lib/schemas"
import { accountEmployeeLinks, employees } from "@/contexts/company/infrastructure/schema/employee"
import {
  applicationApprovals,
  applicationCompletionBindings,
  applications,
  applicationSubjects,
  applicationTemplates,
} from "@/contexts/request/infrastructure/schema/request"
import {
  employeeLifecycleRevisions,
  employeeStatusPeriodVersions,
  employmentPeriodVersions,
  lifecycleEffectTemplateBindings,
  lifecycleMigrationState,
  lifecycleOutbox,
  organizationLifecycleState,
  orgAssignmentPeriodVersions,
  orgResponsibilityPeriodVersions,
  personnelActionRequests,
  personnelActions,
} from "@/contexts/company/infrastructure/schema/employee-lifecycle"
import {
  departments,
  orgDepartments,
  orgMemberships,
} from "@/contexts/company/infrastructure/schema/organization"
import {
  accounts,
  accountRoles,
  auditBatchDecisions,
  auditLogs,
  batchJobs,
  browserLoginCodes,
  cliLoginCodes,
  cliLoginStates,
  identities,
  identityLoginJti,
  notifications,
  permissions,
  refreshTokens,
  rolePermissions,
  roles,
} from "@/contexts/company/infrastructure/schema/compatibility/account-schema"
import {
  systemCoreSchema,
  systemWorkflowSchema,
} from "@/contexts/system/infrastructure/schema/system"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

export {
  accounts,
  accountRoles,
  auditBatchDecisions,
  auditLogs,
  batchJobs,
  browserLoginCodes,
  cliLoginCodes,
  cliLoginStates,
  identities,
  identityLoginJti,
  notifications,
  permissions,
  refreshTokens,
  rolePermissions,
  roles,
  systemSchema,
} from "@/contexts/company/infrastructure/schema/compatibility/account-schema"
export type {
  AccountRoleRow,
  AccountRow,
  AuditBatchDecisionRow,
  AuditLogRow,
  BatchJobRow,
  BrowserLoginCodeRow,
  CliLoginCodeRow,
  CliLoginStateRow,
  IdentityLoginJtiRow,
  IdentityRow,
  NotificationRow,
  PermissionRow,
  RefreshTokenRow,
  RolePermissionRow,
  RoleRow,
} from "@/contexts/company/infrastructure/schema/compatibility/account-schema"
export * from "@/contexts/system/infrastructure/schema/system"
export { accountEmployeeLinks, employees } from "@/contexts/company/infrastructure/schema/employee"
export type {
  AccountEmployeeLinkRow,
  EmployeeRow,
} from "@/contexts/company/infrastructure/schema/employee"
export {
  departments,
  orgDepartments,
  orgMemberships,
} from "@/contexts/company/infrastructure/schema/organization"
export type {
  DepartmentRow,
  OrgDepartmentRow,
  OrgMembershipRow,
} from "@/contexts/company/infrastructure/schema/organization"

/** 研修コース（コード・タイトル・カテゴリ・必須フラグ・状態）。is_required は 0/1 を boolean で持つ。 */
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

/** 受講登録（社員ごとのコース受講状況・スコア・期限）。 */
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

/** 評価サイクル（多面評価の実施単位・期間・状態） */
export const reviewCycles = sqliteTable("review_cycles", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  period: text("period").notNull(),
  status: text("status").notNull(),
  dueDate: text("due_date"),
})

export type ReviewCycleRow = InferSelectModel<typeof reviewCycles>

/** 評価フォーム（サイクル・被評価者・評価者ごとの回答とスコア・状態）。answers は JSON 文字列で保存される。 */
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
  // 開示制御。hidden は被評価者本人に非公開、disclosed で本人閲覧可。既存行は disclosed 互換。
  visibility: text("visibility").notNull().default("disclosed"),
})

export type ReviewFormRow = InferSelectModel<typeof reviewForms>

export const reviewCyclePolicies = sqliteTable("review_cycle_policies", {
  cycleId: integer("cycle_id").primaryKey(),
  policyJson: text("policy_json").notNull(),
})

export type ReviewCyclePolicyRow = InferSelectModel<typeof reviewCyclePolicies>

/** 給与明細（社員ごと・期間ごとの支給/控除/差引支給額） */
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

/** 給与改定の履歴（基本給の改定・前回基本給・適用日） */
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

/** シフトパターン（勤務区分の雛形：勤務時間と休憩） */
export const shiftPatterns = sqliteTable("shift_patterns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  breakMinutes: integer("break_minutes").notNull(),
})

export type ShiftPatternRow = InferSelectModel<typeof shiftPatterns>

/** シフト割当（社員ごとの日次シフト。published_at:null は下書き） */
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

/** シフト交代申請（申請者と交代相手・対象日・承認状態） */
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

/** 休暇申請（本人の申請・承認/却下の記録）。id は自動採番。 */
export const leaveRequests = sqliteTable("leave_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull(),
  leaveType: text("leave_type").notNull().$type<LeaveType>(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  days: integer("days").notNull(),
  unit: text("unit").notNull().$type<LeaveUnit>(),
  hours: real("hours"),
  // 残数消費量（按分計算後）。半休=0.5、時間休=時間数/8、全休=days と同じ。
  consumedDays: real("consumed_days").notNull(),
  reason: text("reason"),
  status: text("status").notNull().$type<LeaveStatus>(),
  approverId: integer("approver_id"),
  decidedComment: text("decided_comment"),
  createdAt: text("created_at").notNull(),
})

export type LeaveRequestRow = InferSelectModel<typeof leaveRequests>

/** 年度ごとの休暇残数（付与・消化・残）。employee_id + fiscal_year + leave_type が主キー。 */
export const leaveBalances = sqliteTable(
  "leave_balances",
  {
    employeeId: integer("employee_id").notNull(),
    fiscalYear: text("fiscal_year").notNull(),
    leaveType: text("leave_type").notNull().$type<LeaveType>(),
    // 半休(0.5)・時間休(時間数/8)の按分に対応するため REAL。
    grantedDays: real("granted_days").notNull(),
    usedDays: real("used_days").notNull(),
    remainingDays: real("remaining_days").notNull(),
  },
  (table) => [primaryKey({ columns: [table.employeeId, table.fiscalYear, table.leaveType] })],
)

export type LeaveBalanceRow = InferSelectModel<typeof leaveBalances>

/** 入社/退職手続きのテンプレート（チェックリストの雛形） */
export const onboardingTemplates = sqliteTable("onboarding_templates", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  description: text("description"),
})

export type OnboardingTemplateRow = InferSelectModel<typeof onboardingTemplates>

/** テンプレートに含まれるタスク定義（並び順・担当ロール） */
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

/** 社員へのテンプレート割り当て（手続きの進行状態） */
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

/** 割り当てから展開された個別タスク（完了状態） */
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

export {
  applicationApprovals,
  applicationCompletionBindings,
  applications,
  applicationSubjects,
  applicationTemplates,
  applicationWorkflowApprovals,
  applicationWorkflowEvents,
  applicationWorkflowInstances,
  applicationWorkflowRevisions,
  applicationWorkflows,
  applicationWorkflowStepCandidates,
  applicationWorkflowStepSnapshots,
  approvalDelegations,
} from "@/contexts/request/infrastructure/schema/request"
export type {
  ApplicationApprovalRow,
  ApplicationCompletionBindingRow,
  ApplicationRow,
  ApplicationSubjectRow,
  ApplicationTemplateRow,
  ApplicationWorkflowApprovalRow,
  ApplicationWorkflowEventRow,
  ApplicationWorkflowInstanceRow,
  ApplicationWorkflowRevisionRow,
  ApplicationWorkflowRow,
  ApplicationWorkflowStepCandidateRow,
  ApplicationWorkflowStepSnapshotRow,
  ApprovalDelegationRow,
} from "@/contexts/request/infrastructure/schema/request"

export {
  employeeLifecycleRevisions,
  employeeStatusPeriodVersions,
  employmentPeriodVersions,
  organizationLifecycleState,
  orgAssignmentPeriodVersions,
  orgResponsibilityPeriodVersions,
  personnelActionRequests,
  personnelActions,
} from "@/contexts/company/infrastructure/schema/employee-lifecycle"
export type {
  EmployeeLifecycleRevisionRow,
  EmployeeStatusPeriodVersionRow,
  EmploymentPeriodVersionRow,
  OrganizationLifecycleStateRow,
  OrgAssignmentPeriodVersionRow,
  OrgResponsibilityPeriodVersionRow,
  PersonnelActionRequestRow,
  PersonnelActionRow,
} from "@/contexts/company/infrastructure/schema/employee-lifecycle"

export {
  lifecycleEffectTemplateBindings,
  lifecycleMigrationState,
  lifecycleOutbox,
} from "@/contexts/company/infrastructure/schema/employee-lifecycle"
export type {
  LifecycleEffectTemplateBindingRow,
  LifecycleMigrationStateRow,
  LifecycleOutboxRow,
} from "@/contexts/company/infrastructure/schema/employee-lifecycle"

/** 資産台帳（asset ドメイン）。code がPK。在庫/貸出/廃棄状態と保有者を持つ。 */
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

/** 貸出記録。open は returned_at が NULL。返却で閉じる。 */
export const assetLendings = sqliteTable("asset_lendings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetCode: text("asset_code").notNull(),
  employeeId: integer("employee_id").notNull(),
  lentAt: text("lent_at").notNull(),
  returnedAt: text("returned_at"),
})

export type AssetLendingRow = InferSelectModel<typeof assetLendings>

/** 棚卸しセッション（stocktake ドメイン）。open→closed の状態を持つ。 */
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

/** 棚卸しセッションでの資産ごとの現物確認記録。checked_at:null は未確認。 */
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

/** 勤怠記録（出勤・退勤の打刻と労働時間）。id は AUTOINCREMENT。 */
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

/** 会社カレンダー（会社休日と振替出勤日の記録）。通常営業日は行を持たない。判定・計算は持たず記録のみ。 */
export const companyCalendarDays = sqliteTable(
  "company_calendar_days",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    calendarDate: text("calendar_date").notNull(),
    kind: text("kind").notNull().$type<CalendarDayKind>(),
    name: text("name"),
    createdAt: text("created_at").notNull(),
  },
  // 同一日の重複登録を DB レベルで防ぐ（1 日 1 行）。
  (table) => [uniqueIndex("uq_company_calendar_days_date").on(table.calendarDate)],
)

export type CompanyCalendarDayRow = InferSelectModel<typeof companyCalendarDays>

/** 従業員の勤務形態の期間つき記録（regular / flextime / discretionary / shift）。制度の適法性判定はしない。事実の記録のみ。 */
export const employeeWorkStyles = sqliteTable(
  "employee_work_styles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull(),
    style: text("style").notNull().$type<WorkStyle>(),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_employee_work_styles_employee").on(table.employeeId)],
)

export type EmployeeWorkStyleRow = InferSelectModel<typeof employeeWorkStyles>

/** 社内公募（部署・必要スキル・公開状態）。 */
export const careerPostings = sqliteTable("career_postings", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  deptId: integer("dept_id"),
  deptName: text("dept_name"),
  requiredSkills: text("required_skills"),
  status: text("status").notNull(),
})

export type CareerPostingRow = InferSelectModel<typeof careerPostings>

/** 公募への応募（応募者・メッセージ・状態）。id は AUTOINCREMENT。 */
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

/** 社員ごとのキャリアシート（目標・強み）。employee_id が主キー。 */
export const careerSheets = sqliteTable("career_sheets", {
  employeeId: integer("employee_id").primaryKey(),
  goalsText: text("goals_text"),
  strengthsText: text("strengths_text"),
  updatedAt: text("updated_at").notNull(),
})

export type CareerSheetRow = InferSelectModel<typeof careerSheets>

/** 経費申請（申請者・カテゴリ・金額・ステータス）。 */
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

/** 経費への承認/却下アクションの記録。 */
export const expenseApprovals = sqliteTable("expense_approvals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expenseId: integer("expense_id").notNull(),
  approverId: integer("approver_id").notNull(),
  action: text("action").notNull().$type<ExpenseApprovalAction>(),
  comment: text("comment"),
  createdAt: text("created_at").notNull(),
})

export type ExpenseApprovalRow = InferSelectModel<typeof expenseApprovals>

/** 稟議（金額つきの汎用決裁）。起案時に承認者を 1 名指定する単段決裁。決裁結果は行に inline 保持する。 */
export const ringiRequests = sqliteTable("ringi_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicantId: integer("applicant_id").notNull(),
  approverId: integer("approver_id").notNull(),
  title: text("title").notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().$type<RingiStatus>(),
  decidedAt: text("decided_at"),
  decisionComment: text("decision_comment"),
  createdAt: text("created_at").notNull(),
})

export type RingiRequestRow = InferSelectModel<typeof ringiRequests>
/** 部署予算（部署・会計期間・金額の記録）。消化額は保持せず、承認済み経費の読み取り集計で算出する。 */
export const budgets = sqliteTable("department_budgets", {
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

/**
 * 目標（社員ごと・評価期間ごとの目標と重み・状態）。
 * owner_type は目標の所有主体(individual/department/company)。parent_goal_id で全社→部門→個人の
 * 階層をつなぎ、department_code は部門目標の所属部門を表す。個人目標では department_code は null。
 */
export const goals = sqliteTable("performance_goals", {
  id: integer("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  period: text("period").notNull(),
  title: text("title").notNull(),
  kpi: text("kpi"),
  weight: integer("weight").notNull(),
  status: text("status").notNull(),
  ownerType: text("owner_type").notNull().default("individual"),
  parentGoalId: integer("parent_goal_id"),
  departmentCode: text("department_code"),
  evaluationSheetId: integer("evaluation_sheet_id"),
})

export type GoalRow = InferSelectModel<typeof goals>

/** 目標への評価（自己・上長・最終） */
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

/**
 * 評価テンプレート（期間ごとの評価項目雛形）。items は JSON 配列で保存する。
 * status は draft（下書き）→ active（運用中）→ archived（廃止）の遷移をとる。
 */
export const evaluationTemplates = sqliteTable(
  "evaluation_templates",
  {
    id: integer("id").primaryKey(),
    title: text("title").notNull(),
    period: text("period").notNull(),
    items: text("items").notNull(),
    status: text("status").notNull().default("draft"),
    createdBy: integer("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_evaluation_templates_period").on(table.period),
    index("idx_evaluation_templates_status").on(table.status),
  ],
)

export type EvaluationTemplateRow = InferSelectModel<typeof evaluationTemplates>

/**
 * 評価シート（評価期 × 社員。MBO の中心エンティティ）。
 * primary/secondary_evaluator_id はシート作成時に org_memberships から解決して固定する。
 * 異動後も評価期間中は変わらない。HR/admin のみ手動変更可（audit_log 記録）。
 */
export const evaluationSheets = sqliteTable(
  "evaluation_sheets",
  {
    id: integer("id").primaryKey(),
    employeeId: integer("employee_id").notNull(),
    templateId: integer("template_id"),
    period: text("period").notNull(),
    status: text("status").notNull().default("draft"),
    primaryEvaluatorId: integer("primary_evaluator_id").notNull(),
    secondaryEvaluatorId: integer("secondary_evaluator_id"),
    submittedAt: text("submitted_at"),
    approvedAt: text("approved_at"),
    finalizedAt: text("finalized_at"),
    revision: integer("revision").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_evaluation_sheets_employee").on(table.employeeId),
    index("idx_evaluation_sheets_period").on(table.period),
    index("idx_evaluation_sheets_status").on(table.status),
    uniqueIndex("uq_evaluation_sheets_employee_period").on(table.employeeId, table.period),
  ],
)

export type EvaluationSheetRow = InferSelectModel<typeof evaluationSheets>

/** 評価シートの監査ログ（操作の事実記録）。 */
export const evaluationSheetAuditLogs = sqliteTable(
  "evaluation_sheet_audit_logs",
  {
    id: integer("id").primaryKey(),
    sheetId: integer("sheet_id").notNull(),
    actorId: integer("actor_id").notNull(),
    action: text("action").notNull(),
    fromValue: text("from_value"),
    toValue: text("to_value"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_evaluation_sheet_audit_logs_sheet").on(table.sheetId)],
)

export type EvaluationSheetAuditLogRow = InferSelectModel<typeof evaluationSheetAuditLogs>

/** ナレッジ記事（社内手続き・規程などの記事） */
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

/** 規程・手続き・統制の安定した業務能力。表示名や担当組織の変更で code は変えない。 */
export const governanceCapabilities = sqliteTable("governance_capabilities", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  ownerOrgRoleCode: text("owner_org_role_code"),
  status: text("status").notNull().$type<"active" | "archived">(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export type GovernanceCapabilityRow = InferSelectModel<typeof governanceCapabilities>

/** 組織上の責任。IAM の system role（操作能力）とは分離する。 */
export const governanceOrgRoles = sqliteTable("governance_org_roles", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  assignmentMode: text("assignment_mode").notNull().$type<"manual" | "department_manager">(),
  cardinality: text("cardinality").notNull().$type<"one" | "per_department" | "many">(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export type GovernanceOrgRoleRow = InferSelectModel<typeof governanceOrgRoles>

export const governanceOrgRoleAssignments = sqliteTable(
  "governance_org_role_assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orgRoleCode: text("org_role_code").notNull(),
    employeeId: integer("employee_id").notNull(),
    departmentCode: text("department_code"),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on"),
    sourceDocumentCode: text("source_document_code"),
    createdByAccountId: integer("created_by_account_id").notNull(),
    createdAt: text("created_at").notNull(),
    revokedByAccountId: integer("revoked_by_account_id"),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    check(
      "governance_org_role_assignments_range",
      sql`${table.endsOn} IS NULL OR ${table.startsOn} < ${table.endsOn}`,
    ),
  ],
)

export type GovernanceOrgRoleAssignmentRow = InferSelectModel<typeof governanceOrgRoleAssignments>

export const governanceDocuments = sqliteTable("governance_documents", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  kind: text("kind").notNull().$type<"policy" | "procedure" | "guideline" | "control">(),
  classification: text("classification")
    .notNull()
    .$type<"public" | "internal" | "confidential" | "restricted">(),
  ownerCapabilityCode: text("owner_capability_code").notNull(),
  stewardOrgRoleCode: text("steward_org_role_code"),
  status: text("status").notNull().$type<"draft" | "published" | "retired">(),
  currentVersionId: text("current_version_id"),
  sourcePath: text("source_path").notNull().unique(),
  createdByAccountId: integer("created_by_account_id").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export type GovernanceDocumentRow = InferSelectModel<typeof governanceDocuments>

export const governanceDocumentVersions = sqliteTable(
  "governance_document_versions",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id").notNull(),
    version: text("version").notNull(),
    bodyMd: text("body_md").notNull(),
    metadataJson: text("metadata_json").notNull(),
    procedureJson: text("procedure_json"),
    contentHash: text("content_hash").notNull(),
    effectiveFrom: text("effective_from"),
    effectiveTo: text("effective_to"),
    reviewDueOn: text("review_due_on"),
    state: text("state")
      .notNull()
      .$type<"draft" | "in_review" | "published" | "superseded" | "rejected">(),
    createdByAccountId: integer("created_by_account_id").notNull(),
    createdAt: text("created_at").notNull(),
    publishedByAccountId: integer("published_by_account_id"),
    publishedAt: text("published_at"),
  },
  (table) => [
    uniqueIndex("uniq_governance_document_version").on(table.documentId, table.version),
    check(
      "governance_document_versions_range",
      sql`${table.effectiveTo} IS NULL OR ${table.effectiveFrom} IS NULL OR ${table.effectiveFrom} < ${table.effectiveTo}`,
    ),
  ],
)

export type GovernanceDocumentVersionRow = InferSelectModel<typeof governanceDocumentVersions>

export const governanceDocumentReferences = sqliteTable(
  "governance_document_references",
  {
    versionId: text("version_id").notNull(),
    kind: text("kind")
      .notNull()
      .$type<
        | "capability"
        | "org_role"
        | "policy"
        | "procedure"
        | "guideline"
        | "control"
        | "permission"
        | "training"
      >(),
    code: text("code").notNull(),
  },
  (table) => [primaryKey({ columns: [table.versionId, table.kind, table.code] })],
)

export type GovernanceDocumentReferenceRow = InferSelectModel<typeof governanceDocumentReferences>

export const governancePublicationApprovals = sqliteTable(
  "governance_publication_approvals",
  {
    versionId: text("version_id").notNull(),
    orgRoleCode: text("org_role_code").notNull(),
    status: text("status").notNull().$type<"pending" | "approved" | "rejected">(),
    decidedByEmployeeId: integer("decided_by_employee_id"),
    decidedAt: text("decided_at"),
    comment: text("comment"),
  },
  (table) => [primaryKey({ columns: [table.versionId, table.orgRoleCode] })],
)

export type GovernancePublicationApprovalRow = InferSelectModel<
  typeof governancePublicationApprovals
>

export const governanceAcknowledgements = sqliteTable(
  "governance_acknowledgements",
  {
    versionId: text("version_id").notNull(),
    employeeId: integer("employee_id").notNull(),
    contentHash: text("content_hash").notNull(),
    acknowledgedAt: text("acknowledged_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.versionId, table.employeeId] })],
)

export type GovernanceAcknowledgementRow = InferSelectModel<typeof governanceAcknowledgements>

/** 1on1 の記録（参加者・実施日時・話題・所感・次アクション）。 */
export const oneOnOnes = sqliteTable("one_on_ones", {
  id: text("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  managerId: integer("manager_id").notNull(),
  heldAt: text("held_at").notNull(),
  topics: text("topics"),
  managerNote: text("manager_note"),
  nextAction: text("next_action"),
  evaluationSheetId: integer("evaluation_sheet_id"),
})

export type OneOnOneRow = InferSelectModel<typeof oneOnOnes>

/** 感謝（サンクス）。送り手が受け手へ送る感謝メッセージ。points は将来のポイント付与用で本 Task では常に 0。 */
export const thanks = sqliteTable("thanks_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  senderEmployeeId: integer("sender_employee_id").notNull(),
  recipientEmployeeId: integer("recipient_employee_id").notNull(),
  message: text("message").notNull(),
  points: integer("points").notNull().default(0),
  createdAt: text("created_at").notNull(),
})

export type ThanksRow = InferSelectModel<typeof thanks>

/**
 * サンクスポイントの月次贈与原資。employee_id + period(YYYY-MM) で一意。
 * 残量は granted_points − consumed_points で算出する。consumed_points は贈与時に
 * 原子的な条件付き UPDATE で加算し、同月の同時送付でも原資超過しないための消費カウンタ。
 */
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

/** サンクスポイントの交換カタログ。stock が null は在庫無制限。is_active は 0/1 を boolean で持つ。 */
export const thanksRewards = sqliteTable("thanks_rewards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  pointCost: integer("point_cost").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull(),
  stock: integer("stock"),
  createdAt: text("created_at").notNull(),
})

export type ThanksRewardRow = InferSelectModel<typeof thanksRewards>

/**
 * サンクスポイントの交換申請。状態は pending→fulfilled（確定）/rejected（却下）。
 * point_cost は申請時点の交換コストを写し取り、後からカタログ価格が変わってもブレないようにする。
 */
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

/** 会議室マスタ（定員・所在地） */
export const rooms = sqliteTable("rooms", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull(),
  location: text("location"),
})

export type RoomRow = InferSelectModel<typeof rooms>

/** 会議室予約（重複判定は start_at/end_at の範囲で行う） */
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

/** スキルマスタ（コード・表示名・カテゴリ） */
export const skills = sqliteTable("skill_definitions", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
})

export type SkillRow = InferSelectModel<typeof skills>

/** 従業員ごとの登録スキル（レベル・経験年数・補足） */
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

/** アンケート（survey ドメイン）。questions_json は設問定義の JSON 文字列。 */
export const surveys = sqliteTable("surveys", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status").notNull(),
  questionsJson: text("questions_json").notNull(),
})

export type SurveyRow = InferSelectModel<typeof surveys>

/** アンケートへの回答。id は自動採番。answers_json は回答内容の JSON 文字列。 */
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

/** 出張申請（行き先・期間・目的・概算費用の記録。金額の計算や判定は持たず記録のみ） */
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

/** 物のレンタル予約（外部からの貸与品の予約申請。期間と用途を記録） */
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

/** 退職申請（申出の受付から書類交付までの記録。法的判定は持たず記録のみ） */
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

/** ライフイベント届出（結婚・出産・転居・忌引・扶養変更などの届出を記録） */
export const lifeEvents = sqliteTable("life_events", {
  id: text("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  eventType: text("event_type").notNull().$type<LifeEventType>(),
  eventDate: text("event_date").notNull(),
  detail: text("detail"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
})

export type LifeEventRow = InferSelectModel<typeof lifeEvents>

/** 産休・育休・介護休業の申出（期限管理と記録。給付金額の計算は持たない） */
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

/** 証明書発行依頼（在職・就労・退職証明書などの発行依頼を記録） */
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

/** 等級マスタ（並び順の rank を持つ等級の定義。判定・計算は持たず定義のみ） */
export const grades = sqliteTable(
  "grade_definitions",
  {
    id: integer("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    rank: integer("rank").notNull(),
    description: text("description"),
    createdAt: text("created_at").notNull(),
  },
  // 等級コードは全社で一意（同一コードの二重登録を防ぐ）。
  (table) => [uniqueIndex("uq_grades_code").on(table.code)],
)

export type GradeRow = InferSelectModel<typeof grades>

/**
 * 役職マスタ（並び順の rank を持つ役職の定義。判定・計算は持たず定義のみ。
 * 役職の期間付き履歴は人事発令が正で、割当履歴テーブルは持たない）
 */
export const positions = sqliteTable(
  "position_definitions",
  {
    id: integer("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    rank: integer("rank").notNull(),
    description: text("description"),
    createdAt: text("created_at").notNull(),
  },
  // 役職コードは全社で一意（同一コードの二重登録を防ぐ）。
  (table) => [uniqueIndex("uq_positions_code").on(table.code)],
)

export type PositionRow = InferSelectModel<typeof positions>

/** 等級の割当履歴（社員ごとに、いつからどの等級か。事実の記録のみ） */
export const employeeGrades = sqliteTable(
  "employee_grades",
  {
    id: integer("id").primaryKey(),
    employeeId: integer("employee_id").notNull(),
    gradeId: integer("grade_id").notNull(),
    effectiveDate: text("effective_date").notNull(),
    reason: text("reason"),
    createdAt: text("created_at").notNull(),
    // 任意で評価サイクルへ紐付ける（等級と評価の接続）。未紐付けは null。
    reviewCycleId: integer("review_cycle_id"),
  },
  // 同一社員・同一発効日の割当の重複を DB レベルで防ぐ。
  (table) => [
    uniqueIndex("uq_employee_grades_employee_effective_date").on(
      table.employeeId,
      table.effectiveDate,
    ),
  ],
)

export type EmployeeGradeRow = InferSelectModel<typeof employeeGrades>

/** 異動・在籍イベント履歴（入社・異動・休職・復職・退職。判定は持たず事実の記録のみ） */
export const employeeEvents = sqliteTable("employee_events", {
  id: integer("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  kind: text("kind").notNull(),
  effectiveDate: text("effective_date").notNull(),
  fromDepartmentCode: text("from_department_code"),
  toDepartmentCode: text("to_department_code"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
})

export type EmployeeEventRow = InferSelectModel<typeof employeeEvents>

/** 年末調整の申告受付（提出状況の記録のみ。税額の計算や判定は持たない） */
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

/** 反社チェックの申請（取引先の確認情報と判定結果を記録） */
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

/** 会議体マスタ（定例会議などの器。cadence は開催頻度メモ） */
export const meetings = sqliteTable(
  "meetings",
  {
    id: integer("id").primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    cadence: text("cadence"),
    description: text("description"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_meetings_status").on(table.status)],
)

export type MeetingRow = InferSelectModel<typeof meetings>

/** 議事録（会議体ごとの開催記録） */
export const meetingMinutes = sqliteTable(
  "meeting_minutes_records",
  {
    id: integer("id").primaryKey(),
    meetingId: integer("meeting_id").notNull(),
    heldOn: text("held_on").notNull(),
    title: text("title").notNull(),
    attendees: text("attendees"),
    bodyMd: text("body_md").notNull(),
    authorEmployeeId: integer("author_employee_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_meeting_minutes_meeting").on(table.meetingId)],
)

export type MeetingMinutesRow = InferSelectModel<typeof meetingMinutes>

/** 意思決定記録（ADR 形式。文脈・決定・帰結を記録し、後続の決定で supersede する） */
export const decisions = sqliteTable(
  "decision_records",
  {
    id: integer("id").primaryKey(),
    title: text("title").notNull(),
    decidedOn: text("decided_on").notNull(),
    context: text("context").notNull(),
    decision: text("decision").notNull(),
    consequences: text("consequences"),
    status: text("status").notNull(),
    supersededById: integer("superseded_by_id"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_decisions_status").on(table.status)],
)

export type DecisionRow = InferSelectModel<typeof decisions>

/** ライセンス・SaaS 台帳（更新期限・管理担当の事実記録。支払・会計連動は持たない） */
export const licenses = sqliteTable("software_licenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  vendor: text("vendor"),
  category: text("category"),
  seats: integer("seats"),
  renewalDeadline: text("renewal_deadline"),
  ownerEmployeeId: integer("owner_employee_id"),
  note: text("note"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
})

export type LicenseRow = InferSelectModel<typeof licenses>

/** インシデント記録（発生した障害・事故の事実記録。原因判定は持たない） */
export const itIncidents = sqliteTable("it_incidents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  occurredAt: text("occurred_at").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  severity: text("severity"),
  status: text("status").notNull(),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").notNull(),
})

export type ItIncidentRow = InferSelectModel<typeof itIncidents>

/** Company: System 監査イベントへ Employee 文脈を付与する append-only satellite。 */
export const auditEventEmployeeContexts = sqliteTable(
  "audit_event_employee_contexts",
  {
    auditEventId: integer("audit_event_id").primaryKey(),
    employeeId: integer("employee_id").notNull(),
  },
  (table) => [
    index("idx_audit_event_employee_contexts_employee").on(table.employeeId, table.auditEventId),
  ],
)

export type AuditEventEmployeeContextRow = InferSelectModel<typeof auditEventEmployeeContexts>

/** 取引先台帳（顧客・仕入先ほか。反社チェック・契約記録の親マスタ） */
export const partners = sqliteTable("partners", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category"),
  corporateNumber: text("corporate_number"),
  note: text("note"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
})

export type PartnerRow = InferSelectModel<typeof partners>

/** 契約記録（契約日・期間・更新期限の事実記録。中身のレビューや法的判定はしない） */
export const contracts = sqliteTable(
  "partner_contracts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    partnerId: integer("partner_id").notNull(),
    title: text("title").notNull(),
    contractDate: text("contract_date").notNull(),
    startsOn: text("starts_on"),
    endsOn: text("ends_on"),
    renewalDeadline: text("renewal_deadline"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_contracts_partner").on(table.partnerId)],
)

export type ContractRow = InferSelectModel<typeof contracts>

/** 社内アナウンス（全社お知らせ。draft→published→archived の状態を持つ）。 */
export const announcements = sqliteTable(
  "announcements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    bodyMd: text("body_md").notNull(),
    publishedOn: text("published_on"),
    authorEmployeeId: integer("author_employee_id").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_announcements_status").on(table.status)],
)

export type AnnouncementRow = InferSelectModel<typeof announcements>

/** 規程集（就業規則などの版管理台帳）。 */
export const regulations = sqliteTable(
  "regulations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull().unique(),
    title: text("title").notNull(),
    category: text("category"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_regulations_status").on(table.status)],
)

export type RegulationRow = InferSelectModel<typeof regulations>

/** 規程の改定版（version は整数の連番。同一規程内で version は一意）。 */
export const regulationVersions = sqliteTable(
  "regulation_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    regulationId: integer("regulation_id").notNull(),
    version: integer("version").notNull(),
    bodyMd: text("body_md").notNull(),
    effectiveOn: text("effective_on").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_regulation_versions_unique").on(table.regulationId, table.version),
    index("idx_regulation_versions_regulation").on(table.regulationId),
  ],
)

export type RegulationVersionRow = InferSelectModel<typeof regulationVersions>

/** 文書台帳（契約書・許認可などのメタデータ台帳。本体ファイルは持たず所在のみ記録する）。 */
export const documents = sqliteTable(
  "document_ledger_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    category: text("category"),
    location: text("location").notNull(),
    partnerCode: text("partner_code"),
    expiresOn: text("expires_on"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_documents_expires_on").on(table.expiresOn)],
)

export type DocumentRow = InferSelectModel<typeof documents>

/** 資格・免許マスタ（コード・名称・発行元・説明）。会社で管理対象とする資格の台帳。 */
export const certifications = sqliteTable("certification_definitions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  issuer: text("issuer"),
  description: text("description"),
  createdAt: text("created_at").notNull(),
})

export type CertificationRow = InferSelectModel<typeof certifications>

/** 従業員の資格保有記録（取得日・有効期限つき）。更新要否の判定はしない（台帳）。 */
export const employeeCertifications = sqliteTable(
  "employee_certifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull(),
    certificationId: integer("certification_id").notNull(),
    acquiredOn: text("acquired_on").notNull(),
    expiresOn: text("expires_on"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  // 同一従業員・同一資格・同一取得日の重複記録を DB レベルで防ぐ。
  (table) => [
    uniqueIndex("idx_employee_certifications_unique").on(
      table.employeeId,
      table.certificationId,
      table.acquiredOn,
    ),
    index("idx_employee_certifications_employee").on(table.employeeId),
  ],
)

export type EmployeeCertificationRow = InferSelectModel<typeof employeeCertifications>

/** 健康診断・ストレスチェックの実施記録のみ。要配慮個人情報である「結果」は絶対に持たない。 */
export const healthCheckups = sqliteTable(
  "health_checkups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull(),
    fiscalYear: integer("fiscal_year").notNull(),
    checkupKind: text("checkup_kind").notNull(),
    conductedOn: text("conducted_on"),
    status: text("status").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_health_checkups_employee").on(table.employeeId),
    index("idx_health_checkups_fiscal_year").on(table.fiscalYear),
  ],
)

export type HealthCheckupRow = InferSelectModel<typeof healthCheckups>

/** 労災・事故の発生記録。起きた事実の時系列記録のみ（記録）。対象者不特定の事故もあるため employee_id は NULL 可。 */
export const workAccidents = sqliteTable(
  "work_accidents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    occurredOn: text("occurred_on").notNull(),
    employeeId: integer("employee_id"),
    location: text("location"),
    summary: text("summary").notNull(),
    severity: text("severity"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_work_accidents_occurred_on").on(table.occurredOn),
    index("idx_work_accidents_employee").on(table.employeeId),
  ],
)

export type WorkAccidentRow = InferSelectModel<typeof workAccidents>

/** 採用の募集ポジション（社外個人情報を扱う候補者の親。open/closed の状態を持つ）。 */
export const recruitmentPositions = sqliteTable(
  "job_openings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    departmentCode: text("department_code"),
    status: text("status").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_recruitment_positions_status").on(table.status)],
)

export type RecruitmentPositionRow = InferSelectModel<typeof recruitmentPositions>

/** 応募者（社外個人情報。選考ステージを applied→…→hired/rejected で進める）。 */
export const recruitmentCandidates = sqliteTable(
  "recruitment_candidates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    positionId: integer("position_id").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    source: text("source"),
    stage: text("stage").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_recruitment_candidates_position").on(table.positionId)],
)

export type RecruitmentCandidateRow = InferSelectModel<typeof recruitmentCandidates>

/** 表彰の記録（社内公開。判定や評価計算は持たず事実の記録のみ）。 */
export const commendations = sqliteTable(
  "commendations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull(),
    title: text("title").notNull(),
    reason: text("reason").notNull(),
    awardedOn: text("awarded_on").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_commendations_employee").on(table.employeeId)],
)

export type CommendationRow = InferSelectModel<typeof commendations>

/** 懲戒の記録（非公開。本人にも見せない設計。判定は持たず事実の記録のみ）。 */
export const disciplinaryActions = sqliteTable(
  "disciplinary_actions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull(),
    kind: text("kind").notNull(),
    summary: text("summary").notNull(),
    decidedOn: text("decided_on").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_disciplinary_actions_employee").on(table.employeeId)],
)

export type DisciplinaryActionRow = InferSelectModel<typeof disciplinaryActions>

/** 人員計画（年度・部署ごとの計画人数。実在籍数との比較は API 側で active 数を添える）。 */
export const headcountPlans = sqliteTable(
  "headcount_plans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fiscalYear: integer("fiscal_year").notNull(),
    departmentCode: text("department_code"),
    plannedCount: integer("planned_count").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  // 同一年度・同一部署の二重登録を DB レベルで防ぐ。
  (table) => [
    uniqueIndex("uq_headcount_plans_year_department").on(table.fiscalYear, table.departmentCode),
  ],
)

export type HeadcountPlanRow = InferSelectModel<typeof headcountPlans>
export const schema = {
  ...systemCoreSchema,
  ...systemWorkflowSchema,
  accounts,
  accountEmployeeLinks,
  identities,
  identityLoginJti,
  cliLoginStates,
  cliLoginCodes,
  browserLoginCodes,
  roles,
  permissions,
  rolePermissions,
  accountRoles,
  refreshTokens,
  auditLogs,
  auditEventEmployeeContexts,
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
  governanceCapabilities,
  governanceOrgRoles,
  governanceOrgRoleAssignments,
  governanceDocuments,
  governanceDocumentVersions,
  governanceDocumentReferences,
  governancePublicationApprovals,
  governanceAcknowledgements,
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
  partners,
  contracts,
  meetings,
  meetingMinutes,
  decisions,
  announcements,
  regulations,
  regulationVersions,
  documents,
  certifications,
  employeeCertifications,
  healthCheckups,
  workAccidents,
  recruitmentPositions,
  recruitmentCandidates,
  commendations,
  disciplinaryActions,
  headcountPlans,
  licenses,
  itIncidents,
}
