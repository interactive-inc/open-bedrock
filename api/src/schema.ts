import type { InferSelectModel } from "drizzle-orm"
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"

// 従業員台帳
export const employees = sqliteTable("employees", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  deptId: integer("dept_id"),
  deptName: text("dept_name"),
  position: text("position"),
  status: text("status").notNull().$type<"active" | "leave" | "retired">(),
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
export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recipientEmployeeId: integer("recipient_employee_id").notNull(),
  sourceDomain: text("source_domain").notNull(),
  sourceId: integer("source_id"),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  isRead: integer("is_read").notNull().default(0),
  createdAt: text("created_at").notNull(),
})

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
export const trainingEnrollments = sqliteTable("training_enrollments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("course_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  status: text("status").notNull(),
  completedAt: text("completed_at"),
  score: integer("score"),
  dueDate: text("due_date"),
})

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
  status: text("status").notNull(),
  submittedAt: text("submitted_at"),
})

export type ReviewFormRow = InferSelectModel<typeof reviewForms>

// 給与明細（社員ごと・期間ごとの支給/控除/差引支給額）
export const payslips = sqliteTable("payslips", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull(),
  period: text("period").notNull(),
  baseSalary: integer("base_salary").notNull(),
  allowances: integer("allowances").notNull(),
  deductions: integer("deductions").notNull(),
  netPay: integer("net_pay").notNull(),
  issuedAt: text("issued_at"),
  status: text("status").notNull(),
})

export type PayslipRow = InferSelectModel<typeof payslips>

// 給与改定の履歴（基本給の改定・前回基本給・適用日）
export const salaryRevisions = sqliteTable("salary_revisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull(),
  effectiveDate: text("effective_date").notNull(),
  previousBaseSalary: integer("previous_base_salary").notNull(),
  newBaseSalary: integer("new_base_salary").notNull(),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
})

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
export const shiftAssignments = sqliteTable("shift_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull(),
  patternId: integer("pattern_id"),
  date: text("date").notNull(),
  note: text("note"),
  publishedAt: text("published_at"),
})

export type ShiftAssignmentRow = InferSelectModel<typeof shiftAssignments>

// シフト交代申請（申請者と交代相手・対象日・承認状態）
export const shiftSwapRequests = sqliteTable("shift_swap_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requesterEmployeeId: integer("requester_employee_id").notNull(),
  targetEmployeeId: integer("target_employee_id").notNull(),
  date: text("date").notNull(),
  note: text("note"),
  status: text("status").notNull(),
  approvedAt: text("approved_at"),
})

export type ShiftSwapRequestRow = InferSelectModel<typeof shiftSwapRequests>

// 休暇申請（本人の申請・承認/却下の記録）。id は自動採番。
export const leaveRequests = sqliteTable("leave_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull(),
  leaveType: text("leave_type").notNull().$type<"annual" | "special">(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  days: integer("days").notNull(),
  reason: text("reason"),
  status: text("status").notNull().$type<"pending" | "approved" | "rejected">(),
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
    leaveType: text("leave_type").notNull().$type<"annual" | "special">(),
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
export const onboardingAssignments = sqliteTable("onboarding_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull(),
  templateCode: text("template_code").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  assignedAt: text("assigned_at").notNull(),
})

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
export const applicationTemplates = sqliteTable("application_templates", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  schemaJson: text("schema_json").notNull(),
  approverRoles: text("approver_roles").notNull(),
})

export type ApplicationTemplateRow = InferSelectModel<typeof applicationTemplates>

// 申請（テンプレートに紐づく申請者の提出）。payload は JSON 文字列で保存される。
export const applications = sqliteTable("applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  templateId: integer("template_id").notNull(),
  applicantId: integer("applicant_id").notNull(),
  status: text("status").notNull(),
  currentStep: text("current_step"),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
})

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

// 資産台帳（asset ドメイン）。code がPK。在庫/貸出状態と保有者を持つ。
export const assets = sqliteTable("assets", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  serial: text("serial"),
  purchasedOn: text("purchased_on"),
  status: text("status").notNull(),
  holderEmployeeId: integer("holder_employee_id"),
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

// 勤怠記録（出勤・退勤の打刻と労働時間）。id は AUTOINCREMENT。
export const attendanceRecords = sqliteTable("attendance_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull(),
  workDate: text("work_date").notNull(),
  clockInAt: text("clock_in_at"),
  clockOutAt: text("clock_out_at"),
  workMinutes: integer("work_minutes"),
  note: text("note"),
  status: text("status").notNull(),
})

export type AttendanceRecordRow = InferSelectModel<typeof attendanceRecords>

// バッチジョブの実行状況（夜間同期・通知送信などの記録）。
export const batchJobs = sqliteTable("batch_jobs", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().$type<"running" | "completed" | "failed">(),
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
export const careerApplications = sqliteTable("career_applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postingId: integer("posting_id").notNull(),
  applicantId: integer("applicant_id").notNull(),
  message: text("message"),
  status: text("status").notNull(),
})

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
  category: text("category")
    .notNull()
    .$type<"transport" | "supplies" | "entertainment" | "books" | "other">(),
  amount: integer("amount").notNull(),
  spentAt: text("spent_at").notNull(),
  note: text("note"),
  status: text("status").notNull().$type<"pending" | "approved" | "rejected" | "settled">(),
  createdAt: text("created_at").notNull(),
})

export type ExpenseRow = InferSelectModel<typeof expenses>

// 経費への承認/却下アクションの記録。
export const expenseApprovals = sqliteTable("expense_approvals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expenseId: integer("expense_id").notNull(),
  approverId: integer("approver_id").notNull(),
  action: text("action").notNull().$type<"approve" | "reject">(),
  comment: text("comment"),
  createdAt: text("created_at").notNull(),
})

export type ExpenseApprovalRow = InferSelectModel<typeof expenseApprovals>

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
export const goalEvaluations = sqliteTable("goal_evaluations", {
  id: integer("id").primaryKey(),
  goalId: integer("goal_id").notNull(),
  evaluatorId: integer("evaluator_id").notNull(),
  kind: text("kind").notNull(),
  score: integer("score"),
  comment: text("comment"),
  createdAt: text("created_at").notNull(),
})

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

// 会議室マスタ（定員・所在地）
export const rooms = sqliteTable("rooms", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull(),
  location: text("location"),
})

export type RoomRow = InferSelectModel<typeof rooms>

// 会議室予約（重複判定は start_at/end_at の範囲で行う）
export const roomReservations = sqliteTable("room_reservations", {
  id: text("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  reserverId: integer("reserver_id").notNull(),
  startAt: text("start_at").notNull(),
  endAt: text("end_at").notNull(),
  purpose: text("purpose"),
})

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
export const surveyResponses = sqliteTable("survey_responses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  surveyId: integer("survey_id").notNull(),
  respondentId: integer("respondent_id").notNull(),
  answersJson: text("answers_json").notNull(),
  submittedAt: text("submitted_at").notNull(),
})

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
export const resignations = sqliteTable("resignations", {
  id: text("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  resignationDate: text("resignation_date").notNull(),
  lastWorkingDate: text("last_working_date"),
  reason: text("reason"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
})

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
export const yearEndAdjustments = sqliteTable("year_end_adjustments", {
  id: text("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  targetYear: integer("target_year").notNull(),
  note: text("note"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
})

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
export const schema = {
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
  assets,
  assetLendings,
  attendanceRecords,
  batchJobs,
  careerPostings,
  careerApplications,
  careerSheets,
  expenses,
  expenseApprovals,
  goals,
  goalEvaluations,
  knowledgeArticles,
  oneOnOnes,
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
