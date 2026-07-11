import { z } from "zod"

// API レスポンスの形を表す Zod スキーマを集約する。各エンドポイントは応答前に
// ここのスキーマで parse して形を保証する。web/cli はこのファイルの型（z.infer）を
// 共有してレスポンスを型付けする。1 ファイル 1 スキーマ規約の例外として 1 ファイルに集約する。

/** 資産 1 件のレスポンス。廃棄済みは disposed_on / disposal_reason を伴う。 */
export const zAppAsset = z.object({
  code: z.string(),
  name: z.string(),
  kind: z.string(),
  serial: z.string().nullable(),
  purchased_on: z.string().nullable(),
  status: z.string(),
  holder_employee_id: z.number().nullable(),
  disposed_on: z.string().nullable().default(null),
  disposal_reason: z.string().nullable().default(null),
})

export type AppAsset = z.infer<typeof zAppAsset>

/** 保有状況一覧（GET /assets/holdings）の 1 件。誰が何をいつ借りているか。 */
export const zAppAssetHolding = z.object({
  asset_code: z.string(),
  asset_name: z.string(),
  kind: z.string(),
  holder_employee_id: z.number(),
  holder_employee_code: z.string(),
  holder_employee_name: z.string(),
  lent_at: z.string().nullable(),
})

export type AppAssetHolding = z.infer<typeof zAppAssetHolding>

/** 保有状況一覧のレスポンス。 */
export const zAppAssetHoldingList = z.object({
  data: z.array(zAppAssetHolding),
  total: z.number(),
})

export type AppAssetHoldingList = z.infer<typeof zAppAssetHoldingList>

/** 棚卸しセッション 1 件（対象資産の確認状況を含む）。 */
export const zAppStocktakeItem = z.object({
  asset_code: z.string(),
  asset_name: z.string(),
  kind: z.string(),
  checked_at: z.string().nullable(),
  checker_employee_id: z.number().nullable(),
  location_note: z.string().nullable(),
})

export type AppStocktakeItem = z.infer<typeof zAppStocktakeItem>

/** 棚卸しセッション 1 件のレスポンス（詳細。items を含む）。 */
export const zAppStocktake = z.object({
  id: z.string(),
  name: z.string(),
  target_date: z.string(),
  status: z.enum(["open", "closed"]),
  created_at: z.string(),
  closed_at: z.string().nullable(),
  checked_count: z.number(),
  total_count: z.number(),
  items: z.array(zAppStocktakeItem).default([]),
})

export type AppStocktake = z.infer<typeof zAppStocktake>

/** 棚卸しセッション一覧の 1 件（items を含まない）。 */
export const zAppStocktakeListItem = z.object({
  id: z.string(),
  name: z.string(),
  target_date: z.string(),
  status: z.enum(["open", "closed"]),
  created_at: z.string(),
  closed_at: z.string().nullable(),
  checked_count: z.number(),
  total_count: z.number(),
})

export type AppStocktakeListItem = z.infer<typeof zAppStocktakeListItem>

/** 棚卸しセッション一覧のレスポンス。 */
export const zAppStocktakeList = z.object({
  data: z.array(zAppStocktakeListItem),
  total: z.number(),
})

export type AppStocktakeList = z.infer<typeof zAppStocktakeList>

/** 資産一覧のレスポンス。 */
export const zAppAssetList = z.object({
  data: z.array(zAppAsset),
  total: z.number(),
})

export type AppAssetList = z.infer<typeof zAppAssetList>

// ===========================================================================
// 以下、各ドメインのレスポンススキーマ
// ===========================================================================

// ===== antisocial-check =====
export const zAppAntisocialCheck = z.object({
  id: z.string(),
  requester_id: z.number(),
  partner_name: z.string(),
  partner_address: z.string().nullable(),
  representative_name: z.string().nullable(),
  result: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})
export type AppAntisocialCheck = z.infer<typeof zAppAntisocialCheck>

export const zAppAntisocialCheckList = z.object({
  data: z.array(zAppAntisocialCheck),
  total: z.number(),
})
export type AppAntisocialCheckList = z.infer<typeof zAppAntisocialCheckList>

/** 管理受信箱の反社チェック申請。申請者名を含む。 */
export const zAppAntisocialCheckAdminItem = zAppAntisocialCheck.extend({
  requester_name: z.string(),
})

export const zAppAntisocialCheckAdminList = z.object({
  data: z.array(zAppAntisocialCheckAdminItem),
  total: z.number(),
})

export type AppAntisocialCheckAdminList = z.infer<typeof zAppAntisocialCheckAdminList>

// ===== application =====
/** 申請への承認/却下アクション 1 件。GET /applications/:id の approvals[] に並ぶ。 */
export const zAppApplicationApproval = z.object({
  id: z.number(),
  approver_name: z.string(),
  action: z.enum(["approve", "reject"]),
  comment: z.string().nullable(),
  created_at: z.string(),
})

export type AppApplicationApproval = z.infer<typeof zAppApplicationApproval>

/** 申請 1 件（詳細・作成のレスポンス）。GET /applications/:id と POST /applications で使う。 */
export const zAppApplication = z.object({
  id: z.number(),
  template_code: z.string(),
  template_name: z.string(),
  applicant_name: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  current_step: z.string().nullable(),
  payload: z.unknown(),
  created_at: z.string(),
  /** 承認/却下の履歴。古い順。POST /applications の直後は空配列で返す。 */
  approvals: z.array(zAppApplicationApproval).default([]),
  /** テンプレートの承認可能ロール（空配列なら application:approve 権限保持者）。 */
  approver_roles: z.array(z.string()).default([]),
})

export type AppApplication = z.infer<typeof zAppApplication>

/** 申請一覧（GET /applications）の 1 件。payload は含まない。 */
export const zAppApplicationListItem = z.object({
  id: z.number(),
  template_name: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  current_step: z.string().nullable(),
  created_at: z.string(),
})

export type AppApplicationListItem = z.infer<typeof zAppApplicationListItem>

/** 申請一覧（GET /applications）のレスポンス。 */
export const zAppApplicationList = z.object({
  data: z.array(zAppApplicationListItem),
  total: z.number(),
})

export type AppApplicationList = z.infer<typeof zAppApplicationList>

/** 承認待ち一覧（GET /applications/inbox）の 1 件。applicant_name を含む。 */
export const zAppApplicationInboxItem = z.object({
  id: z.number(),
  template_name: z.string(),
  applicant_name: z.string(),
  current_step: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string(),
})

export type AppApplicationInboxItem = z.infer<typeof zAppApplicationInboxItem>

/** 承認待ち一覧（GET /applications/inbox）のレスポンス。 */
export const zAppApplicationInboxList = z.object({
  data: z.array(zAppApplicationInboxItem),
  total: z.number(),
})

export type AppApplicationInboxList = z.infer<typeof zAppApplicationInboxList>

/** 全社申請一覧（GET /applications/admin）の 1 件。applicant_name と template_code を含む。 */
export const zAppApplicationAdminItem = z.object({
  id: z.number(),
  template_code: z.string(),
  template_name: z.string(),
  template_category: z.string(),
  applicant_id: z.number(),
  applicant_name: z.string(),
  applicant_dept_name: z.string().nullable(),
  current_step: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string(),
})

export type AppApplicationAdminItem = z.infer<typeof zAppApplicationAdminItem>

/** 全社申請一覧（GET /applications/admin）のレスポンス。 */
export const zAppApplicationAdminList = z.object({
  data: z.array(zAppApplicationAdminItem),
  total: z.number(),
})

export type AppApplicationAdminList = z.infer<typeof zAppApplicationAdminList>

/** 本人の申請一覧（GET /applications/me）の 1 件。template_id と payload を含む。 */
export const zAppApplicationMineItem = z.object({
  id: z.number().nullable(),
  template_id: z.number(),
  status: z.enum(["pending", "approved", "rejected"]),
  current_step: z.string().nullable(),
  payload: z.unknown(),
  created_at: z.string(),
})

export type AppApplicationMineItem = z.infer<typeof zAppApplicationMineItem>

/** 本人の申請一覧（GET /applications/me）のレスポンス。 */
export const zAppApplicationMineList = z.object({
  data: z.array(zAppApplicationMineItem),
  total: z.number(),
})

export type AppApplicationMineList = z.infer<typeof zAppApplicationMineList>

/** 申請内容更新（PUT /applications/:id）のレスポンス。 */
export const zAppApplicationUpdated = z.object({
  id: z.number().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  payload: z.unknown(),
})

export type AppApplicationUpdated = z.infer<typeof zAppApplicationUpdated>

/** 承認・却下（POST /applications/:id/approve, /reject）のレスポンス。 */
export const zAppApplicationDecision = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
})

export type AppApplicationDecision = z.infer<typeof zAppApplicationDecision>

/** 申請テンプレート詳細（GET /templates/:code）のレスポンス。 */
export const zAppApplicationTemplate = z.object({
  code: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string().nullable(),
  schema_json: z.unknown(),
  approver_roles: z.array(z.string()),
})

export type AppApplicationTemplate = z.infer<typeof zAppApplicationTemplate>

/** 申請テンプレート作成・更新（POST /templates, PUT /templates/:code）のレスポンス。id を含む。 */
export const zAppApplicationTemplateDetail = z.object({
  id: z.number().nullable(),
  code: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string().nullable(),
  schema_json: z.unknown(),
  approver_roles: z.array(z.string()),
})

export type AppApplicationTemplateDetail = z.infer<typeof zAppApplicationTemplateDetail>

/** 申請テンプレート一覧（GET /templates）の 1 件。schema_json と approver_roles は含まない。 */
export const zAppApplicationTemplateListItem = z.object({
  code: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string().nullable(),
})

export type AppApplicationTemplateListItem = z.infer<typeof zAppApplicationTemplateListItem>

/** 申請テンプレート一覧（GET /templates）のレスポンス。 */
export const zAppApplicationTemplateList = z.object({
  data: z.array(zAppApplicationTemplateListItem),
  total: z.number(),
})

export type AppApplicationTemplateList = z.infer<typeof zAppApplicationTemplateList>

// ===== attendance =====
/** 勤怠記録 1 件のレスポンス。 */
export const zAppAttendanceRecord = z.object({
  id: z.number(),
  employee_id: z.number(),
  work_date: z.string(),
  clock_in_at: z.string().nullable(),
  clock_out_at: z.string().nullable(),
  work_minutes: z.number().nullable(),
  status: z.string(),
})

export type AppAttendanceRecord = z.infer<typeof zAppAttendanceRecord>

/** 勤怠記録一覧のレスポンス。 */
export const zAppAttendanceRecordList = z.object({
  data: z.array(zAppAttendanceRecord),
  total: z.number(),
})

export type AppAttendanceRecordList = z.infer<typeof zAppAttendanceRecordList>

/** 本人の指定月の勤怠集計レスポンス。 */
export const zAppAttendanceSummary = z.object({
  employee_id: z.number(),
  month: z.string(),
  work_days: z.number(),
  total_work_minutes: z.number(),
})

export type AppAttendanceSummary = z.infer<typeof zAppAttendanceSummary>

// ===== auth =====
/** ログイン成功時のアクセストークンとリフレッシュトークン。 */
export const zAppAuthToken = z.object({
  access_token: z.string(),
  refresh_token: z.string().nullable(),
})

export type AppAuthToken = z.infer<typeof zAppAuthToken>

/** 認証済み本人の社員情報（GET /me）。 */
export const zAppAuthMe = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  dept_name: z.string().nullable(),
  position: z.string().nullable(),
  permissions: z.array(z.string()),
  role_keys: z.array(z.string()),
})

export type AppAuthMe = z.infer<typeof zAppAuthMe>

// ===== business-trip =====
export const zAppBusinessTrip = z.object({
  id: z.string(),
  traveler_id: z.number(),
  destination: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  purpose: z.string(),
  estimated_cost: z.number().nullable(),
  status: z.string(),
  created_at: z.string(),
})

export type AppBusinessTrip = z.infer<typeof zAppBusinessTrip>

export const zAppBusinessTripList = z.object({
  data: z.array(zAppBusinessTrip),
  total: z.number(),
})

export type AppBusinessTripList = z.infer<typeof zAppBusinessTripList>

// ===== career =====
export const zAppCareerPosting = z.object({
  id: z.number().nullable(),
  title: z.string(),
  dept_id: z.number().nullable(),
  dept_name: z.string().nullable(),
  required_skills: z.string().nullable(),
  status: z.enum(["open", "closed"]),
})

export type AppCareerPosting = z.infer<typeof zAppCareerPosting>

export const zAppCareerPostingList = z.object({
  data: z.array(zAppCareerPosting),
  total: z.number(),
})

export type AppCareerPostingList = z.infer<typeof zAppCareerPostingList>

export const zAppCareerApplication = z.object({
  id: z.number().nullable(),
  posting_id: z.number(),
  applicant_id: z.number(),
  message: z.string().nullable(),
  status: z.enum(["applied", "accepted", "rejected"]),
})

export type AppCareerApplication = z.infer<typeof zAppCareerApplication>

export const zAppCareerApplicationList = z.object({
  data: z.array(zAppCareerApplication),
  total: z.number(),
})

export type AppCareerApplicationList = z.infer<typeof zAppCareerApplicationList>

export const zAppCareerSheet = z.object({
  employee_id: z.number(),
  goals_text: z.string().nullable(),
  strengths_text: z.string().nullable(),
  updated_at: z.string().nullable(),
})

export type AppCareerSheet = z.infer<typeof zAppCareerSheet>

// ===== certificate-request =====
/** 証明書発行依頼 1 件のレスポンス。 */
export const zAppCertificateRequest = z.object({
  id: z.string(),
  requester_id: z.number(),
  certificate_type: z.string(),
  submit_to: z.string().nullable(),
  needed_by: z.string().nullable(),
  note: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

export type AppCertificateRequest = z.infer<typeof zAppCertificateRequest>

/** 証明書発行依頼一覧のレスポンス。 */
export const zAppCertificateRequestList = z.object({
  data: z.array(zAppCertificateRequest),
  total: z.number(),
})

export type AppCertificateRequestList = z.infer<typeof zAppCertificateRequestList>

// ===== employee =====
/** 従業員 1 件のレスポンス（単体取得・登録・更新）。role を含む。 */
export const zAppEmployee = z.object({
  code: z.string(),
  name: z.string(),
  dept_name: z.string().nullable(),
  position: z.string().nullable(),
  email: z.string(),
  status: z.string(),
  role: z.string(),
})

export type AppEmployee = z.infer<typeof zAppEmployee>

/** 従業員一覧の行。role を含まない。 */
export const zAppEmployeeListItem = z.object({
  code: z.string(),
  name: z.string(),
  dept_name: z.string().nullable(),
  position: z.string().nullable(),
  email: z.string(),
  status: z.string(),
})

export type AppEmployeeListItem = z.infer<typeof zAppEmployeeListItem>

/** 従業員一覧のレスポンス。 */
export const zAppEmployeeList = z.object({
  data: z.array(zAppEmployeeListItem),
  total: z.number(),
})

export type AppEmployeeList = z.infer<typeof zAppEmployeeList>

/** 全従業員が参照できる社内ディレクトリの行。機微な認証・在籍情報は含めない。 */
export const zAppEmployeeDirectoryItem = z.object({
  code: z.string(),
  name: z.string(),
  dept_name: z.string().nullable(),
  position: z.string().nullable(),
})

export type AppEmployeeDirectoryItem = z.infer<typeof zAppEmployeeDirectoryItem>

/** 在籍中の従業員ディレクトリ一覧。 */
export const zAppEmployeeDirectoryList = z.object({
  data: z.array(zAppEmployeeDirectoryItem),
  total: z.number(),
})

export type AppEmployeeDirectoryList = z.infer<typeof zAppEmployeeDirectoryList>

// ===== expense =====
/** 経費 1 件のレスポンス（申請・更新の戻り）。 */
const expenseCategory = z.enum(["transport", "supplies", "entertainment", "books", "other"])

const expenseStatus = z.enum(["pending", "approved", "rejected", "settled"])

export const zAppExpense = z.object({
  id: z.number(),
  employee_id: z.number(),
  category: expenseCategory,
  amount: z.number(),
  spent_at: z.string(),
  note: z.string().nullable(),
  status: expenseStatus,
  created_at: z.string(),
})

export type AppExpense = z.infer<typeof zAppExpense>

/** 経費詳細のレスポンス（申請者名を含む）。 */
export const zAppExpenseDetail = z.object({
  id: z.number(),
  employee_id: z.number(),
  applicant_name: z.string(),
  category: expenseCategory,
  amount: z.number(),
  spent_at: z.string(),
  note: z.string().nullable(),
  status: expenseStatus,
  created_at: z.string(),
})

export type AppExpenseDetail = z.infer<typeof zAppExpenseDetail>

/** 本人の経費一覧の 1 件。 */
export const zAppExpenseMineItem = z.object({
  id: z.number(),
  category: expenseCategory,
  amount: z.number(),
  spent_at: z.string(),
  status: expenseStatus,
  created_at: z.string(),
})

export type AppExpenseMineItem = z.infer<typeof zAppExpenseMineItem>

/** 本人の経費一覧のレスポンス。 */
export const zAppExpenseMineList = z.object({
  data: z.array(zAppExpenseMineItem),
  total: z.number(),
})

export type AppExpenseMineList = z.infer<typeof zAppExpenseMineList>

/** 承認待ち経費一覧の 1 件（申請者名を含む）。 */
export const zAppExpenseInboxItem = z.object({
  id: z.number(),
  applicant_name: z.string(),
  category: expenseCategory,
  amount: z.number(),
  spent_at: z.string(),
  status: expenseStatus,
  created_at: z.string(),
})

export type AppExpenseInboxItem = z.infer<typeof zAppExpenseInboxItem>

/** 承認待ち経費一覧のレスポンス。 */
export const zAppExpenseInboxList = z.object({
  data: z.array(zAppExpenseInboxItem),
  total: z.number(),
})

export type AppExpenseInboxList = z.infer<typeof zAppExpenseInboxList>

/** 経費の承認・却下結果（status のみ）。 */
export const zAppExpenseDecision = z.object({
  status: expenseStatus,
})

export type AppExpenseDecision = z.infer<typeof zAppExpenseDecision>

/** 全社経費申請一覧（GET /expenses/admin）の 1 件。 */
export const zAppExpenseAdminItem = z.object({
  id: z.number(),
  applicant_id: z.number(),
  applicant_name: z.string(),
  applicant_dept_name: z.string().nullable(),
  category: expenseCategory,
  amount: z.number(),
  spent_at: z.string(),
  status: expenseStatus,
  created_at: z.string(),
})

export type AppExpenseAdminItem = z.infer<typeof zAppExpenseAdminItem>

/** 全社経費申請一覧（GET /expenses/admin）のレスポンス。 */
export const zAppExpenseAdminList = z.object({
  data: z.array(zAppExpenseAdminItem),
  total: z.number(),
})

export type AppExpenseAdminList = z.infer<typeof zAppExpenseAdminList>

// ===== budget =====

/** 部署予算 1 件のレスポンス。 */
export const zAppBudget = z.object({
  id: z.number(),
  department_id: z.number(),
  fiscal_period: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  amount: z.number(),
  name: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
})

export type AppBudget = z.infer<typeof zAppBudget>

/** 部署予算一覧（GET /budgets）の 1 件。部署名を含む。 */
export const zAppBudgetListItem = z.object({
  id: z.number(),
  department_id: z.number(),
  department_name: z.string().nullable(),
  fiscal_period: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  amount: z.number(),
  name: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
})

export type AppBudgetListItem = z.infer<typeof zAppBudgetListItem>

/** 部署予算一覧（GET /budgets）のレスポンス。 */
export const zAppBudgetList = z.object({
  data: z.array(zAppBudgetListItem),
  total: z.number(),
})

export type AppBudgetList = z.infer<typeof zAppBudgetList>

/** 部署予算の詳細（GET /budgets/:id）。承認済み経費の消化額・残額を含む。 */
export const zAppBudgetDetail = z.object({
  id: z.number(),
  department_id: z.number(),
  department_name: z.string().nullable(),
  fiscal_period: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  amount: z.number(),
  name: z.string(),
  note: z.string().nullable(),
  consumed_amount: z.number(),
  remaining_amount: z.number(),
  created_at: z.string(),
})

export type AppBudgetDetail = z.infer<typeof zAppBudgetDetail>

/** 消化状況の横断ビュー（GET /budgets/summary）の 1 件。 */
export const zAppBudgetSummaryItem = z.object({
  department_id: z.number(),
  department_name: z.string().nullable(),
  fiscal_period: z.string(),
  budget_amount: z.number(),
  consumed_amount: z.number(),
  remaining_amount: z.number(),
})

export type AppBudgetSummaryItem = z.infer<typeof zAppBudgetSummaryItem>

/** 消化状況の横断ビュー（GET /budgets/summary）のレスポンス。 */
export const zAppBudgetSummary = z.object({
  fiscal_period: z.string(),
  data: z.array(zAppBudgetSummaryItem),
})

export type AppBudgetSummary = z.infer<typeof zAppBudgetSummary>

// ===== family-care-leave =====
export const zAppFamilyCareLeave = z.object({
  id: z.string(),
  employee_id: z.number(),
  leave_kind: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  note: z.string().nullable(),
  status: z.enum(["requested", "approved", "cancelled"]),
  created_at: z.string(),
})
export type AppFamilyCareLeave = z.infer<typeof zAppFamilyCareLeave>

export const zAppFamilyCareLeaveList = z.object({
  data: z.array(zAppFamilyCareLeave),
  total: z.number(),
})
export type AppFamilyCareLeaveList = z.infer<typeof zAppFamilyCareLeaveList>

// ===== goal =====
/** 目標 1 件のレスポンス。 */
export const zAppGoal = z.object({
  id: z.number(),
  employee_id: z.number(),
  period: z.string(),
  title: z.string(),
  kpi: z.string().nullable(),
  weight: z.number(),
  status: z.string(),
})

export type AppGoal = z.infer<typeof zAppGoal>

/** 目標一覧のレスポンス。 */
export const zAppGoalList = z.object({
  data: z.array(zAppGoal),
  total: z.number(),
})

export type AppGoalList = z.infer<typeof zAppGoalList>

/** 目標評価 1 件のレスポンス。 */
export const zAppGoalEvaluation = z.object({
  id: z.number(),
  goal_id: z.number(),
  evaluator_id: z.number(),
  kind: z.string(),
  score: z.number().nullable(),
  comment: z.string().nullable(),
  created_at: z.string(),
})

export type AppGoalEvaluation = z.infer<typeof zAppGoalEvaluation>

// ===== knowledge =====
/** ナレッジ記事一覧の 1 件（本文は snippet に短縮）。 */
export const zAppKnowledgeListItem = z.object({
  id: z.number(),
  category: z.string(),
  title: z.string(),
  snippet: z.string(),
  author_id: z.number(),
  created_at: z.string(),
})

export type AppKnowledgeListItem = z.infer<typeof zAppKnowledgeListItem>

/** ナレッジ記事一覧のレスポンス。 */
export const zAppKnowledgeList = z.object({
  data: z.array(zAppKnowledgeListItem),
  total: z.number(),
})

export type AppKnowledgeList = z.infer<typeof zAppKnowledgeList>

/** ナレッジ記事 1 件の詳細レスポンス（GET /knowledge/:id）。 */
export const zAppKnowledge = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string(),
  tags: z.string().nullable(),
  body_md: z.string(),
  author_id: z.number(),
  created_at: z.string(),
})

export type AppKnowledge = z.infer<typeof zAppKnowledge>

/** ナレッジ記事の作成・更新レスポンス（POST /knowledge, PUT /knowledge/:id）。 */
export const zAppKnowledgeWritten = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string(),
  tags: z.string().nullable(),
  body_md: z.string(),
})

export type AppKnowledgeWritten = z.infer<typeof zAppKnowledgeWritten>

// ===== leave =====
/** 休暇申請 1 件のレスポンス（作成・承認・却下時）。approver_id と decided_comment を含む。 */
export const zAppLeaveRequest = z.object({
  id: z.number(),
  employee_id: z.number(),
  leave_type: z.enum(["annual", "special"]),
  start_date: z.string(),
  end_date: z.string(),
  days: z.number(),
  reason: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  approver_id: z.number().nullable(),
  decided_comment: z.string().nullable(),
  created_at: z.string(),
})

export type AppLeaveRequest = z.infer<typeof zAppLeaveRequest>

/** 休暇申請の詳細レスポンス（GET/PUT /requests/:id）。approver_id と decided_comment を含まない。 */
export const zAppLeaveRequestDetail = z.object({
  id: z.number(),
  employee_id: z.number(),
  leave_type: z.enum(["annual", "special"]),
  start_date: z.string(),
  end_date: z.string(),
  days: z.number(),
  reason: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string(),
})

export type AppLeaveRequestDetail = z.infer<typeof zAppLeaveRequestDetail>

/** 本人の休暇申請一覧 1 件（GET /requests/me）。 */
export const zAppLeaveRequestSummary = z.object({
  id: z.number(),
  leave_type: z.enum(["annual", "special"]),
  start_date: z.string(),
  end_date: z.string(),
  days: z.number(),
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string(),
})

export type AppLeaveRequestSummary = z.infer<typeof zAppLeaveRequestSummary>

/** 本人の休暇申請一覧のレスポンス。 */
export const zAppLeaveRequestSummaryList = z.object({
  data: z.array(zAppLeaveRequestSummary),
  total: z.number(),
})

export type AppLeaveRequestSummaryList = z.infer<typeof zAppLeaveRequestSummaryList>

/** 承認待ち休暇申請一覧 1 件（GET /requests/inbox）。applicant_name を含む。 */
export const zAppLeaveRequestInbox = z.object({
  id: z.number(),
  applicant_name: z.string(),
  leave_type: z.enum(["annual", "special"]),
  start_date: z.string(),
  end_date: z.string(),
  days: z.number(),
  reason: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string(),
})

export type AppLeaveRequestInbox = z.infer<typeof zAppLeaveRequestInbox>

/** 承認待ち休暇申請一覧のレスポンス。 */
export const zAppLeaveRequestInboxList = z.object({
  data: z.array(zAppLeaveRequestInbox),
  total: z.number(),
})

export type AppLeaveRequestInboxList = z.infer<typeof zAppLeaveRequestInboxList>

/** 全社休暇申請一覧（GET /leave/requests/admin）の 1 件。 */
export const zAppLeaveRequestAdminItem = z.object({
  id: z.number(),
  applicant_id: z.number(),
  applicant_name: z.string(),
  applicant_dept_name: z.string().nullable(),
  leave_type: z.enum(["annual", "special"]),
  start_date: z.string(),
  end_date: z.string(),
  days: z.number(),
  reason: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string(),
})

export type AppLeaveRequestAdminItem = z.infer<typeof zAppLeaveRequestAdminItem>

/** 全社休暇申請一覧（GET /leave/requests/admin）のレスポンス。 */
export const zAppLeaveRequestAdminList = z.object({
  data: z.array(zAppLeaveRequestAdminItem),
  total: z.number(),
})

export type AppLeaveRequestAdminList = z.infer<typeof zAppLeaveRequestAdminList>

/** 本人の休暇残数 1 件（GET /balance/me）。 */
export const zAppLeaveBalance = z.object({
  fiscal_year: z.string(),
  leave_type: z.enum(["annual", "special"]),
  granted_days: z.number(),
  used_days: z.number(),
  remaining_days: z.number(),
})

export type AppLeaveBalance = z.infer<typeof zAppLeaveBalance>

/** 本人の休暇残数一覧（GET /balance/me）。配列を直接返す（data/total ラップなし）。 */
export const zAppLeaveBalanceList = z.array(zAppLeaveBalance)

export type AppLeaveBalanceList = z.infer<typeof zAppLeaveBalanceList>

// ===== life-event =====
export const zAppLifeEvent = z.object({
  id: z.string(),
  employee_id: z.number(),
  event_type: z.string(),
  event_date: z.string(),
  detail: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

export type AppLifeEvent = z.infer<typeof zAppLifeEvent>

export const zAppLifeEventList = z.object({
  data: z.array(zAppLifeEvent),
  total: z.number(),
})

export type AppLifeEventList = z.infer<typeof zAppLifeEventList>

// ===== notification =====
export const zAppNotification = z.object({
  id: z.number(),
  recipient_employee_id: z.number(),
  source_domain: z.string(),
  source_id: z.number().nullable(),
  kind: z.enum([
    "task",
    "approval_request",
    "approval_result",
    "reminder",
    "announcement",
    "thanks",
  ]),
  title: z.string(),
  body: z.string().nullable(),
  is_read: z.boolean(),
  created_at: z.string(),
})

export type AppNotification = z.infer<typeof zAppNotification>

export const zAppNotificationList = z.object({
  data: z.array(zAppNotification),
  total: z.number(),
})

export type AppNotificationList = z.infer<typeof zAppNotificationList>

// ===== onboarding =====
/** オンボーディングテンプレート 1 件のレスポンス。 */
export const zAppOnboardingTemplate = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  kind: z.string(),
  description: z.string().nullable(),
})

export type AppOnboardingTemplate = z.infer<typeof zAppOnboardingTemplate>

/** オンボーディングテンプレート一覧の要素。task_count を持ち id は持たない。 */
export const zAppOnboardingTemplateListItem = z.object({
  code: z.string(),
  name: z.string(),
  kind: z.string(),
  description: z.string().nullable(),
  task_count: z.number(),
})

export type AppOnboardingTemplateListItem = z.infer<typeof zAppOnboardingTemplateListItem>

/** オンボーディングテンプレート一覧のレスポンス。 */
export const zAppOnboardingTemplateList = z.object({
  data: z.array(zAppOnboardingTemplateListItem),
  total: z.number(),
})

export type AppOnboardingTemplateList = z.infer<typeof zAppOnboardingTemplateList>

/** オンボーディングタスク 1 件のレスポンス。 */
export const zAppOnboardingTask = z.object({
  id: z.number(),
  template_task_code: z.string(),
  title: z.string(),
  order: z.number(),
  status: z.string(),
  completed_at: z.string().nullable(),
})

export type AppOnboardingTask = z.infer<typeof zAppOnboardingTask>

/** オンボーディングタスク一覧のレスポンス。 */
export const zAppOnboardingTaskList = z.object({
  data: z.array(zAppOnboardingTask),
  total: z.number(),
})

export type AppOnboardingTaskList = z.infer<typeof zAppOnboardingTaskList>

/** オンボーディング割り当て 1 件のレスポンス。template_name は割当一覧/作成時のみ含む。 */
export const zAppOnboardingAssignment = z.object({
  id: z.number(),
  employee_code: z.string(),
  employee_name: z.string(),
  template_code: z.string(),
  template_name: z.string().optional(),
  kind: z.string(),
  status: z.string(),
  assigned_at: z.string(),
  tasks: z.array(zAppOnboardingTask),
})

export type AppOnboardingAssignment = z.infer<typeof zAppOnboardingAssignment>

/** オンボーディング割り当て一覧のレスポンス。 */
export const zAppOnboardingAssignmentList = z.object({
  data: z.array(zAppOnboardingAssignment),
  total: z.number(),
})

export type AppOnboardingAssignmentList = z.infer<typeof zAppOnboardingAssignmentList>

// ===== oneonone =====
/** 1on1 1 件のレスポンス。参加者名込み。 */
export const zAppOneOnOne = z.object({
  id: z.string(),
  held_at: z.string(),
  member_name: z.string(),
  manager_name: z.string(),
  topics: z.string().nullable(),
  manager_note: z.string().nullable(),
  next_action: z.string().nullable(),
})

export type AppOneOnOne = z.infer<typeof zAppOneOnOne>

/** 1on1 一覧のレスポンス。 */
export const zAppOneOnOneList = z.object({
  data: z.array(zAppOneOnOne),
  total: z.number(),
})

export type AppOneOnOneList = z.infer<typeof zAppOneOnOneList>

// ===== org =====
/** 組織部署ノード 1 件のレスポンス。 */
export const zAppOrgDepartment = z.object({
  code: z.string(),
  department_id: z.number(),
  parent_code: z.string().nullable(),
  manager_employee_code: z.string().nullable(),
  order: z.number(),
})

export type AppOrgDepartment = z.infer<typeof zAppOrgDepartment>

/** 組織部署ノード一覧のレスポンス（配列直接）。 */
export const zAppOrgDepartmentList = z.array(zAppOrgDepartment)

export type AppOrgDepartmentList = z.infer<typeof zAppOrgDepartmentList>

/** 部署所属メンバー 1 件のレスポンス。 */
export const zAppOrgDepartmentMember = z.object({
  employee_code: z.string(),
  employee_name: z.string(),
  position: z.string().nullable(),
  manager_employee_code: z.string().nullable(),
  is_manager: z.boolean(),
})

export type AppOrgDepartmentMember = z.infer<typeof zAppOrgDepartmentMember>

/** 部署所属メンバー一覧のレスポンス（配列直接）。 */
export const zAppOrgDepartmentMemberList = z.array(zAppOrgDepartmentMember)

export type AppOrgDepartmentMemberList = z.infer<typeof zAppOrgDepartmentMemberList>

/** レポートラインノード 1 件のレスポンス。 */
export const zAppOrgReportingLineNode = z.object({
  employee_code: z.string(),
  employee_name: z.string(),
  department_code: z.string().nullable(),
  position: z.string().nullable(),
  depth: z.number(),
})

export type AppOrgReportingLineNode = z.infer<typeof zAppOrgReportingLineNode>

/** レポートライン一覧のレスポンス（本人から上位への配列直接）。 */
export const zAppOrgReportingLineList = z.array(zAppOrgReportingLineNode)

export type AppOrgReportingLineList = z.infer<typeof zAppOrgReportingLineList>

/** 組織ツリーノード 1 件のレスポンス（children で再帰）。 */
export type AppOrgTreeNode = {
  code: string
  name: string
  manager_employee_code: string | null
  member_count: number
  children: ReadonlyArray<AppOrgTreeNode>
}

export const zAppOrgTreeNode: z.ZodType<AppOrgTreeNode> = z.object({
  code: z.string(),
  name: z.string(),
  manager_employee_code: z.string().nullable(),
  member_count: z.number(),
  children: z.array(z.lazy(() => zAppOrgTreeNode)),
})

/** 組織ツリーのレスポンス（ルートノードの配列直接）。 */
export const zAppOrgTreeList = z.array(zAppOrgTreeNode)

export type AppOrgTreeList = z.infer<typeof zAppOrgTreeList>

// ===== rental =====
export const zAppRentalReservation = z.object({
  id: z.string(),
  requester_id: z.number(),
  item_name: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  purpose: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

export type AppRentalReservation = z.infer<typeof zAppRentalReservation>

export const zAppRentalReservationList = z.object({
  data: z.array(zAppRentalReservation),
  total: z.number(),
})

export type AppRentalReservationList = z.infer<typeof zAppRentalReservationList>

// ===== resignation =====
export const zAppResignation = z.object({
  id: z.string(),
  employee_id: z.number(),
  resignation_date: z.string(),
  last_working_date: z.string().nullable(),
  reason: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

export type AppResignation = z.infer<typeof zAppResignation>

export const zAppResignationList = z.object({
  data: z.array(zAppResignation),
  total: z.number(),
})

export type AppResignationList = z.infer<typeof zAppResignationList>

// ===== review =====
/** 評価サイクル 1 件のレスポンス。 */
export const zAppReviewCycle = z.object({
  id: z.number(),
  title: z.string(),
  period: z.string(),
  status: z.string(),
  due_date: z.string().nullable(),
})

export type AppReviewCycle = z.infer<typeof zAppReviewCycle>

/** 評価サイクル一覧のレスポンス。 */
export const zAppReviewCycleList = z.object({
  data: z.array(zAppReviewCycle),
  total: z.number(),
})

export type AppReviewCycleList = z.infer<typeof zAppReviewCycleList>

/** 評価フォーム 1 件のレスポンス。submit は comment を含む。 */
export const zAppReviewForm = z.object({
  id: z.number(),
  cycle_id: z.number(),
  subject_employee_id: z.number(),
  reviewer_employee_id: z.number(),
  reviewer_type: z.string(),
  answers: z.array(z.unknown()),
  score: z.number().nullable(),
  comment: z.string().nullable(),
  status: z.string(),
  submitted_at: z.string().nullable(),
})

export type AppReviewForm = z.infer<typeof zAppReviewForm>

/** 評価フォーム一覧（comment を含まない）の要素。 */
export const zAppReviewFormSummary = z.object({
  id: z.number(),
  cycle_id: z.number(),
  subject_employee_id: z.number(),
  reviewer_employee_id: z.number(),
  reviewer_type: z.string(),
  answers: z.array(z.unknown()),
  score: z.number().nullable(),
  status: z.string(),
  submitted_at: z.string().nullable(),
})

export type AppReviewFormSummary = z.infer<typeof zAppReviewFormSummary>

/** 自分宛て評価フォーム一覧のレスポンス。 */
export const zAppReviewFormList = z.object({
  data: z.array(zAppReviewFormSummary),
  total: z.number(),
})

export type AppReviewFormList = z.infer<typeof zAppReviewFormList>

/** 被評価者ごとの評価結果サマリのレスポンス。 */
export const zAppReviewResult = z.object({
  cycle_id: z.number(),
  subject_employee_id: z.number(),
  form_count: z.number(),
  submitted_count: z.number(),
  average_score: z.number().nullable(),
  forms: z.array(zAppReviewFormSummary),
})

export type AppReviewResult = z.infer<typeof zAppReviewResult>

// ===== room =====
/** 会議室マスタ 1 件のレスポンス。 */
export const zAppRoom = z.object({
  id: z.number(),
  name: z.string(),
  capacity: z.number(),
  location: z.string().nullable(),
})

export type AppRoom = z.infer<typeof zAppRoom>

/** 会議室マスタ一覧のレスポンス。 */
export const zAppRoomList = z.object({
  data: z.array(zAppRoom),
  total: z.number(),
})

export type AppRoomList = z.infer<typeof zAppRoomList>

/** 会議室予約 1 件のレスポンス。 */
export const zAppRoomReservation = z.object({
  id: z.string(),
  room_id: z.number(),
  reserver_id: z.number(),
  start_at: z.string(),
  end_at: z.string(),
  purpose: z.string().nullable(),
})

export type AppRoomReservation = z.infer<typeof zAppRoomReservation>

/** 会議室予約一覧のレスポンス。 */
export const zAppRoomReservationList = z.object({
  data: z.array(zAppRoomReservation),
  total: z.number(),
})

export type AppRoomReservationList = z.infer<typeof zAppRoomReservationList>

/** 会議室空き状況 1 件のレスポンス。conflicts のフィールドは camelCase。 */
export const zAppRoomAvailability = z.object({
  room: z.object({
    id: z.number(),
    name: z.string(),
    capacity: z.number(),
  }),
  available: z.boolean(),
  conflicts: z.array(
    z.object({
      startAt: z.string(),
      endAt: z.string(),
      purpose: z.string().nullable(),
    }),
  ),
})

export type AppRoomAvailability = z.infer<typeof zAppRoomAvailability>

/** 会議室空き状況一覧のレスポンス。 */
export const zAppRoomAvailabilityList = z.object({
  data: z.array(zAppRoomAvailability),
  total: z.number(),
})

export type AppRoomAvailabilityList = z.infer<typeof zAppRoomAvailabilityList>

// ===== shift =====
/** シフトパターン 1 件のレスポンス。 */
export const zAppShiftPattern = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  break_minutes: z.number(),
})

export type AppShiftPattern = z.infer<typeof zAppShiftPattern>

/** シフトパターン一覧のレスポンス。 */
export const zAppShiftPatternList = z.object({
  data: z.array(zAppShiftPattern),
  total: z.number(),
})

export type AppShiftPatternList = z.infer<typeof zAppShiftPatternList>

/** シフト割当 1 件のレスポンス。 */
export const zAppShiftAssignment = z.object({
  id: z.number(),
  employee_id: z.number(),
  pattern_id: z.number().nullable(),
  date: z.string(),
  note: z.string().nullable(),
  published_at: z.string().nullable(),
})

export type AppShiftAssignment = z.infer<typeof zAppShiftAssignment>

/** シフト割当一覧のレスポンス。 */
export const zAppShiftAssignmentList = z.object({
  data: z.array(zAppShiftAssignment),
  total: z.number(),
})

export type AppShiftAssignmentList = z.infer<typeof zAppShiftAssignmentList>

/** シフト交代申請 1 件のレスポンス（社員 ID で表現）。 */
export const zAppShiftSwapRequest = z.object({
  id: z.number(),
  requester_employee_id: z.number(),
  target_employee_id: z.number(),
  date: z.string(),
  note: z.string().nullable(),
  status: z.string(),
  approved_at: z.string().nullable(),
})

export type AppShiftSwapRequest = z.infer<typeof zAppShiftSwapRequest>

/** シフト交代申請一覧（本人向け。社員 ID で表現）のレスポンス。 */
export const zAppShiftSwapRequestList = z.object({
  data: z.array(zAppShiftSwapRequest),
  total: z.number(),
})

export type AppShiftSwapRequestList = z.infer<typeof zAppShiftSwapRequestList>

/** 承認待ちシフト交代申請一覧の要素（社員コードで表現）。 */
export const zAppShiftSwapRequestPending = z.object({
  id: z.number(),
  requester_employee_code: z.string(),
  target_employee_code: z.string(),
  date: z.string(),
  note: z.string().nullable(),
  status: z.string(),
  approved_at: z.string().nullable(),
})

export type AppShiftSwapRequestPending = z.infer<typeof zAppShiftSwapRequestPending>

/** 承認待ちシフト交代申請一覧のレスポンス。 */
export const zAppShiftSwapRequestPendingList = z.object({
  data: z.array(zAppShiftSwapRequestPending),
  total: z.number(),
})

export type AppShiftSwapRequestPendingList = z.infer<typeof zAppShiftSwapRequestPendingList>

/** 全社シフト交代申請一覧（GET /shift/swap-requests/admin）の 1 件。社員名・部署も付与する。 */
export const zAppShiftSwapRequestAdminItem = z.object({
  id: z.number(),
  requester_employee_id: z.number(),
  requester_employee_code: z.string(),
  requester_name: z.string(),
  requester_dept_name: z.string().nullable(),
  target_employee_id: z.number(),
  target_employee_code: z.string(),
  target_name: z.string(),
  date: z.string(),
  note: z.string().nullable(),
  status: z.string(),
  approved_at: z.string().nullable(),
})

export type AppShiftSwapRequestAdminItem = z.infer<typeof zAppShiftSwapRequestAdminItem>

/** 全社シフト交代申請一覧のレスポンス。 */
export const zAppShiftSwapRequestAdminList = z.object({
  data: z.array(zAppShiftSwapRequestAdminItem),
  total: z.number(),
})

export type AppShiftSwapRequestAdminList = z.infer<typeof zAppShiftSwapRequestAdminList>

// ===== skill =====
/** スキルマスタ 1 件のレスポンス。 */
export const zAppSkill = z.object({
  code: z.string(),
  name: z.string(),
  category: z.string(),
})

export type AppSkill = z.infer<typeof zAppSkill>

/** スキルマスタ一覧のレスポンス。 */
export const zAppSkillList = z.object({
  data: z.array(zAppSkill),
  total: z.number(),
})

export type AppSkillList = z.infer<typeof zAppSkillList>

/** 本人の登録スキル 1 件のレスポンス（スキルマスタ結合済み）。 */
export const zAppEmployeeSkill = z.object({
  skill_code: z.string(),
  skill_name: z.string(),
  skill_category: z.string(),
  level: z.number(),
  years: z.number().nullable(),
  note: z.string().nullable(),
})

export type AppEmployeeSkill = z.infer<typeof zAppEmployeeSkill>

/** 本人の登録スキル一覧のレスポンス。 */
export const zAppEmployeeSkillList = z.object({
  data: z.array(zAppEmployeeSkill),
  total: z.number(),
})

export type AppEmployeeSkillList = z.infer<typeof zAppEmployeeSkillList>

// ===== survey =====
export const zAppSurvey = z.object({
  id: z.number(),
  title: z.string(),
  status: z.enum(["open", "closed"]),
  questions_json: z.array(z.unknown()),
})

export type AppSurvey = z.infer<typeof zAppSurvey>

export const zAppSurveyList = z.object({
  data: z.array(zAppSurvey),
  total: z.number(),
})

export type AppSurveyList = z.infer<typeof zAppSurveyList>

export const zAppSurveyResponse = z.object({
  id: z.number().nullable(),
  survey_id: z.number(),
  respondent_id: z.number(),
  answers_json: z.unknown(),
  submitted_at: z.string(),
})

export type AppSurveyResponse = z.infer<typeof zAppSurveyResponse>

export const zAppSurveyResponseList = z.object({
  data: z.array(zAppSurveyResponse),
  total: z.number(),
})

export type AppSurveyResponseList = z.infer<typeof zAppSurveyResponseList>

export const zAppSurveySummaryQuestion = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["scale", "choice", "text"]),
  distribution: z.record(z.string(), z.number()),
  answers: z.array(z.string()),
})

export type AppSurveySummaryQuestion = z.infer<typeof zAppSurveySummaryQuestion>

export const zAppSurveySummary = z.object({
  survey_id: z.number(),
  title: z.string(),
  response_count: z.number(),
  is_truncated: z.boolean(),
  questions: z.array(zAppSurveySummaryQuestion),
})

export type AppSurveySummary = z.infer<typeof zAppSurveySummary>

// ===== thanks =====
export const zAppThanks = z.object({
  id: z.number().nullable(),
  sender_employee_id: z.number(),
  sender_name: z.string(),
  recipient_employee_id: z.number(),
  recipient_name: z.string(),
  message: z.string(),
  points: z.number(),
  created_at: z.string(),
})
export type AppThanks = z.infer<typeof zAppThanks>

export const zAppThanksList = z.object({
  data: z.array(zAppThanks),
  total: z.number(),
})
export type AppThanksList = z.infer<typeof zAppThanksList>

// ===== thanks-points =====
/** Thanks ポイントの交換カタログ 1 件のレスポンス。 */
export const zAppThanksReward = z.object({
  id: z.number(),
  name: z.string(),
  point_cost: z.number(),
  is_active: z.boolean(),
  stock: z.number().nullable(),
  created_at: z.string(),
})

export type AppThanksReward = z.infer<typeof zAppThanksReward>

/** 交換カタログ一覧のレスポンス。 */
export const zAppThanksRewardList = z.object({
  data: z.array(zAppThanksReward),
  total: z.number(),
})

export type AppThanksRewardList = z.infer<typeof zAppThanksRewardList>

/** Thanks ポイントの交換申請 1 件のレスポンス。 */
export const zAppThanksRedemption = z.object({
  id: z.number().nullable(),
  employee_id: z.number(),
  reward_id: z.number(),
  point_cost: z.number(),
  status: z.enum(["pending", "rejected", "fulfilled"]),
  created_at: z.string(),
  decided_at: z.string().nullable(),
  decider_id: z.number().nullable(),
})

export type AppThanksRedemption = z.infer<typeof zAppThanksRedemption>

/** 交換申請一覧のレスポンス。 */
export const zAppThanksRedemptionList = z.object({
  data: z.array(zAppThanksRedemption),
  total: z.number(),
})

export type AppThanksRedemptionList = z.infer<typeof zAppThanksRedemptionList>

/** 交換申請の承認・却下の決定結果。stock_warning は承認時のみ含まれる。 */
export const zAppThanksRedemptionDecision = z.object({
  id: z.number(),
  status: z.enum(["pending", "rejected", "fulfilled"]),
  stock_warning: z.boolean().optional(),
})

export type AppThanksRedemptionDecision = z.infer<typeof zAppThanksRedemptionDecision>

/** 全社サンクス交換申請一覧（GET /thanks/redemptions/admin）の 1 件。申請者名・景品名を含む。 */
export const zAppThanksRedemptionAdminItem = z.object({
  id: z.number(),
  employee_id: z.number(),
  employee_name: z.string(),
  employee_dept_name: z.string().nullable(),
  reward_id: z.number(),
  reward_name: z.string(),
  point_cost: z.number(),
  status: z.enum(["pending", "rejected", "fulfilled"]),
  created_at: z.string(),
  decided_at: z.string().nullable(),
  decider_id: z.number().nullable(),
})

export type AppThanksRedemptionAdminItem = z.infer<typeof zAppThanksRedemptionAdminItem>

/** 全社サンクス交換申請一覧のレスポンス。 */
export const zAppThanksRedemptionAdminList = z.object({
  data: z.array(zAppThanksRedemptionAdminItem),
  total: z.number(),
})

export type AppThanksRedemptionAdminList = z.infer<typeof zAppThanksRedemptionAdminList>

/** 自分の受領残高のレスポンス。 */
export const zAppThanksBalance = z.object({
  balance_points: z.number(),
})

export type AppThanksBalance = z.infer<typeof zAppThanksBalance>

/** 自分の当月の贈与原資のレスポンス。 */
export const zAppThanksBudget = z.object({
  period: z.string(),
  granted_points: z.number(),
  consumed_points: z.number(),
  remaining_points: z.number(),
})

export type AppThanksBudget = z.infer<typeof zAppThanksBudget>

// ===== training =====
/** 研修コース 1 件のレスポンス。 */
export const zAppTrainingCourse = z.object({
  id: z.number(),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  duration_minutes: z.number().nullable(),
  category: z.string(),
  is_required: z.boolean(),
  status: z.string(),
})

export type AppTrainingCourse = z.infer<typeof zAppTrainingCourse>

/** 研修コース一覧のレスポンス。 */
export const zAppTrainingCourseList = z.object({
  data: z.array(zAppTrainingCourse),
  total: z.number(),
})

export type AppTrainingCourseList = z.infer<typeof zAppTrainingCourseList>

/** 受講登録 1 件のレスポンス。 */
export const zAppTrainingEnrollment = z.object({
  id: z.number(),
  course_id: z.number(),
  employee_id: z.number(),
  status: z.string(),
  completed_at: z.string().nullable(),
  score: z.number().nullable(),
  due_date: z.string().nullable(),
})

export type AppTrainingEnrollment = z.infer<typeof zAppTrainingEnrollment>

/** 受講登録一覧のレスポンス。 */
export const zAppTrainingEnrollmentList = z.object({
  data: z.array(zAppTrainingEnrollment),
  total: z.number(),
})

export type AppTrainingEnrollmentList = z.infer<typeof zAppTrainingEnrollmentList>

// ===== iam =====
/** ロール 1 件のレスポンス。 */
export const zAppRole = z.object({
  id: z.number(),
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  is_system: z.boolean(),
  permission_keys: z.array(z.string()),
})

export type AppRole = z.infer<typeof zAppRole>

/** ロール一覧のレスポンス。 */
export const zAppRoleList = z.object({
  data: z.array(zAppRole),
  total: z.number(),
})

export type AppRoleList = z.infer<typeof zAppRoleList>

/** ロール詳細のレスポンス（割当済み permission キー付き）。 */
export const zAppRoleDetail = z.object({
  id: z.number(),
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  is_system: z.boolean(),
  permission_keys: z.array(z.string()),
})

export type AppRoleDetail = z.infer<typeof zAppRoleDetail>

/** 権限カタログ 1 件のレスポンス。 */
export const zAppPermission = z.object({
  key: z.string(),
  description: z.string(),
  category: z.string(),
})

export type AppPermission = z.infer<typeof zAppPermission>

/** 権限カタログ一覧のレスポンス。 */
export const zAppPermissionList = z.object({
  data: z.array(zAppPermission),
  total: z.number(),
})

export type AppPermissionList = z.infer<typeof zAppPermissionList>

/** アカウント 1 件のレスポンス(管理一覧)。 */
export const zAppAccount = z.object({
  id: z.number(),
  employee_id: z.number().nullable(),
  employee_name: z.string().nullable(),
  status: z.string(),
  role_keys: z.array(z.string()),
  can_manage: z.boolean(),
  is_self: z.boolean(),
})

export type AppAccount = z.infer<typeof zAppAccount>

/** アカウント一覧のレスポンス。 */
export const zAppAccountList = z.object({
  data: z.array(zAppAccount),
  total: z.number(),
})

export type AppAccountList = z.infer<typeof zAppAccountList>
