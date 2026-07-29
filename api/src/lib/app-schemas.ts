import { leaveTypeSchema, leaveUnitSchema, lifeEventTypeSchema } from "@/lib/schemas"
import { z } from "zod"

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
  // 保有者は employees.code の innerJoin。外部プロビジョニングの保有者は code=null になり得るため nullable。
  holder_employee_code: z.string().nullable(),
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

/**
 * ===========================================================================
 * 以下、各ドメインのレスポンススキーマ
 * ===========================================================================
 * ===== antisocial-check =====
 */
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

/** 申請への承認/却下アクション 1 件。GET /application-requests/:id の approvals[] に並ぶ。 */
export const zAppApplicationApproval = z.object({
  id: z.number(),
  approver_name: z.string(),
  action: z.enum(["approve", "reject"]),
  comment: z.string().nullable(),
  created_at: z.string(),
})

export type AppApplicationApproval = z.infer<typeof zAppApplicationApproval>

export const zAppApplicationWorkflowApproval = z.object({
  id: z.number(),
  step_key: z.string(),
  round: z.number(),
  approver_name: z.string(),
  represented_approver_name: z.string(),
  action: z.enum(["approve", "reject", "return"]),
  comment: z.string().nullable(),
  created_at: z.string(),
})

export const zAppApplicationWorkflowProgress = z.object({
  current_step_key: z.string(),
  current_round: z.number(),
  started_at: z.string(),
  due_at: z.string().nullable(),
  returned: z.boolean(),
  steps: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      status: z.enum(["waiting", "pending", "approved", "rejected", "returned"]),
    }),
  ),
  approvals: z.array(zAppApplicationWorkflowApproval),
})

/** 申請 1 件（詳細・作成のレスポンス）。GET /application-requests/:id と POST /application-requests で使う。 */
export const zAppApplication = z.object({
  id: z.number(),
  template_code: z.string(),
  template_name: z.string(),
  applicant_name: z.string(),
  subject: z
    .object({
      type: z.enum(["employee", "prospective_employee"]),
      employee_code: z.string(),
      employee_name: z.string(),
    })
    .nullable()
    .default(null),
  target_department: z.object({ code: z.string(), name: z.string() }).nullable().default(null),
  status: z.enum(["pending", "approved", "rejected"]),
  current_step: z.string().nullable(),
  payload: z.unknown(),
  created_at: z.string(),
  /** 承認/却下の履歴。古い順。POST /application-requests の直後は空配列で返す。 */
  approvals: z.array(zAppApplicationApproval).default([]),
  /** テンプレートの承認可能ロール（空配列なら application:approve 権限保持者）。 */
  approver_roles: z.array(z.string()).default([]),
  workflow: zAppApplicationWorkflowProgress.nullable().default(null),
})

export type AppApplication = z.infer<typeof zAppApplication>

/** 申請一覧（GET /application-requests）の 1 件。payload は含まない。 */
export const zAppApplicationListItem = z.object({
  id: z.number(),
  template_name: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  current_step: z.string().nullable(),
  created_at: z.string(),
})

export type AppApplicationListItem = z.infer<typeof zAppApplicationListItem>

/** 申請一覧（GET /application-requests）のレスポンス。 */
export const zAppApplicationList = z.object({
  data: z.array(zAppApplicationListItem),
  total: z.number(),
})

export type AppApplicationList = z.infer<typeof zAppApplicationList>

/** 承認待ち一覧（GET /application-requests/inbox）の 1 件。applicant_name を含む。 */
export const zAppApplicationInboxItem = z.object({
  id: z.number(),
  template_name: z.string(),
  applicant_name: z.string(),
  current_step: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string(),
})

export type AppApplicationInboxItem = z.infer<typeof zAppApplicationInboxItem>

/** 承認待ち一覧（GET /application-requests/inbox）のレスポンス。 */
export const zAppApplicationInboxList = z.object({
  data: z.array(zAppApplicationInboxItem),
  total: z.number(),
})

export type AppApplicationInboxList = z.infer<typeof zAppApplicationInboxList>

/** 全社申請一覧（GET /application-requests/admin）の 1 件。applicant_name と template_code を含む。 */
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

/** 全社申請一覧（GET /application-requests/admin）のレスポンス。 */
export const zAppApplicationAdminList = z.object({
  data: z.array(zAppApplicationAdminItem),
  total: z.number(),
})

export type AppApplicationAdminList = z.infer<typeof zAppApplicationAdminList>

/** 本人の申請一覧（GET /application-requests/me）の 1 件。template_id と payload を含む。 */
export const zAppApplicationMineItem = z.object({
  id: z.number().nullable(),
  template_id: z.number(),
  status: z.enum(["pending", "approved", "rejected"]),
  current_step: z.string().nullable(),
  payload: z.unknown(),
  created_at: z.string(),
})

export type AppApplicationMineItem = z.infer<typeof zAppApplicationMineItem>

/** 本人の申請一覧（GET /application-requests/me）のレスポンス。 */
export const zAppApplicationMineList = z.object({
  data: z.array(zAppApplicationMineItem),
  total: z.number(),
})

export type AppApplicationMineList = z.infer<typeof zAppApplicationMineList>

/** 申請内容更新（PUT /application-requests/:id）のレスポンス。 */
export const zAppApplicationUpdated = z.object({
  id: z.number().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  payload: z.unknown(),
})

export type AppApplicationUpdated = z.infer<typeof zAppApplicationUpdated>

/** 承認・却下（POST /application-requests/:id/approve, /reject）のレスポンス。 */
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

/** 部署別の在籍人数。 */
export const zAppDepartmentHeadcount = z.object({
  department_name: z.string().nullable(),
  headcount: z.number(),
})

export type AppDepartmentHeadcount = z.infer<typeof zAppDepartmentHeadcount>

/** 期間ごとの目標達成(done)率。done_rate は 0-1。 */
export const zAppGoalDoneRate = z.object({
  period: z.string(),
  total: z.number(),
  done: z.number(),
  done_rate: z.number(),
})

export type AppGoalDoneRate = z.infer<typeof zAppGoalDoneRate>

/** 経営ダッシュボードの横断集計レスポンス(GET /dashboard/management)。集計のみで予測は持たない。 */
export const zAppManagementDashboard = z.object({
  employee_count: z.number(),
  department_headcounts: z.array(zAppDepartmentHeadcount),
  recent_join_count: z.number(),
  recent_retire_count: z.number(),
  attendance_record_count: z.number(),
  leave_request_count: z.number(),
  leave_pending_count: z.number(),
  expense_count: z.number(),
  expense_pending_count: z.number(),
  open_review_cycle_count: z.number(),
  pending_application_count: z.number(),
  goal_done_rates: z.array(zAppGoalDoneRate),
})

export type AppManagementDashboard = z.infer<typeof zAppManagementDashboard>

/** ログイン成功時のアクセストークンとリフレッシュトークン。 */
export const zAppAuthToken = z.object({
  access_token: z.string(),
  refresh_token: z.string().nullable(),
})

export type AppAuthToken = z.infer<typeof zAppAuthToken>

/** ブラウザへログインを受け渡すための one-time code と、その残り有効秒数。 */
export const zAppBrowserLoginCode = z.object({
  code: z.string(),
  expires_in: z.number(),
})

export type AppBrowserLoginCode = z.infer<typeof zAppBrowserLoginCode>

/** 初期 ROOT ブートストラップ成功時に返す、作成したアカウント・従業員・メール。 */
export const zAppBootstrapResult = z.object({
  account_id: z.number(),
  employee_id: z.number(),
  email: z.string(),
})

export type AppBootstrapResult = z.infer<typeof zAppBootstrapResult>

/** 外部 identity 同期（プロビジョニング）の件数サマリ。 */
export const zAppProvisioningSummary = z.object({
  created: z.number(),
  updated: z.number(),
  skipped: z.number(),
})

export type AppProvisioningSummary = z.infer<typeof zAppProvisioningSummary>

/** 認証済み本人の社員情報（GET /me）。 */
export const zAppAuthMe = z.object({
  id: z.number(),
  // 外部プロビジョニングで作られた本人は社員コードを持たない（code=null）。GET /me は本人の code を
  // そのまま返すため nullable。
  code: z.string().nullable(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  dept_name: z.string().nullable(),
  position: z.string().nullable(),
  permissions: z.array(z.string()),
  role_keys: z.array(z.string()),
  phone: z.string().nullable(),
})

export type AppAuthMe = z.infer<typeof zAppAuthMe>

/** 本人の電話番号（PUT /me/phone）。 */
export const zAppMyPhone = z.object({
  phone: z.string().nullable(),
})

export type AppMyPhone = z.infer<typeof zAppMyPhone>

/** ===== business-trip ===== */
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

/** ===== career ===== */
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
  // GET /employees は全従業員を列挙し、外部プロビジョニングの code=null 行も含むため nullable。
  code: z.string().nullable(),
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
  // GET /directory/employees は在籍中の全従業員を列挙し、code=null 行も含むため nullable。
  code: z.string().nullable(),
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

/** ===== ringi ===== */
const ringiStatus = z.enum(["pending", "approved", "rejected"])

/** 稟議 1 件のレスポンス。 */
export const zAppRingi = z.object({
  id: z.number(),
  applicant_id: z.number(),
  approver_id: z.number(),
  title: z.string(),
  amount: z.number(),
  reason: z.string(),
  status: ringiStatus,
  decided_at: z.string().nullable(),
  decision_comment: z.string().nullable(),
  created_at: z.string(),
})

export type AppRingi = z.infer<typeof zAppRingi>

/** 本人が起案した稟議一覧の 1 件。 */
export const zAppRingiMineItem = z.object({
  id: z.number(),
  approver_id: z.number(),
  approver_name: z.string(),
  title: z.string(),
  amount: z.number(),
  status: ringiStatus,
  decided_at: z.string().nullable(),
  created_at: z.string(),
})

export type AppRingiMineItem = z.infer<typeof zAppRingiMineItem>

/** 本人が起案した稟議一覧のレスポンス。 */
export const zAppRingiMineList = z.object({
  data: z.array(zAppRingiMineItem),
  total: z.number(),
})

export type AppRingiMineList = z.infer<typeof zAppRingiMineList>

/** 承認待ち稟議一覧（自分が承認者）の 1 件。 */
export const zAppRingiInboxItem = z.object({
  id: z.number(),
  applicant_id: z.number(),
  applicant_name: z.string(),
  title: z.string(),
  amount: z.number(),
  reason: z.string(),
  status: ringiStatus,
  created_at: z.string(),
})

export type AppRingiInboxItem = z.infer<typeof zAppRingiInboxItem>

/** 承認待ち稟議一覧のレスポンス。 */
export const zAppRingiInboxList = z.object({
  data: z.array(zAppRingiInboxItem),
  total: z.number(),
})

export type AppRingiInboxList = z.infer<typeof zAppRingiInboxList>

/** 稟議の承認・却下結果（status のみ）。 */
export const zAppRingiDecision = z.object({
  status: ringiStatus,
})

export type AppRingiDecision = z.infer<typeof zAppRingiDecision>

/** 全社稟議一覧（GET /ringi-requests/admin）の 1 件。 */
export const zAppRingiAdminItem = z.object({
  id: z.number(),
  applicant_id: z.number(),
  applicant_name: z.string(),
  applicant_dept_name: z.string().nullable(),
  approver_id: z.number(),
  approver_name: z.string(),
  title: z.string(),
  amount: z.number(),
  status: ringiStatus,
  decided_at: z.string().nullable(),
  created_at: z.string(),
})

export type AppRingiAdminItem = z.infer<typeof zAppRingiAdminItem>

/** 全社稟議一覧（GET /ringi-requests/admin）のレスポンス。 */
export const zAppRingiAdminList = z.object({
  data: z.array(zAppRingiAdminItem),
  total: z.number(),
})

export type AppRingiAdminList = z.infer<typeof zAppRingiAdminList>

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

/** 部署予算一覧（GET /department-budgets）の 1 件。部署名を含む。 */
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

/** 部署予算一覧（GET /department-budgets）のレスポンス。 */
export const zAppBudgetList = z.object({
  data: z.array(zAppBudgetListItem),
  total: z.number(),
})

export type AppBudgetList = z.infer<typeof zAppBudgetList>

/** 部署予算の詳細（GET /department-budgets/:id）。承認済み経費の消化額・残額を含む。 */
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

/** 消化状況の横断ビュー（GET /department-budgets/summary）の 1 件。 */
export const zAppBudgetSummaryItem = z.object({
  department_id: z.number(),
  department_name: z.string().nullable(),
  fiscal_period: z.string(),
  budget_amount: z.number(),
  consumed_amount: z.number(),
  remaining_amount: z.number(),
})

export type AppBudgetSummaryItem = z.infer<typeof zAppBudgetSummaryItem>

/** 消化状況の横断ビュー（GET /department-budgets/summary）のレスポンス。 */
export const zAppBudgetSummary = z.object({
  fiscal_period: z.string(),
  data: z.array(zAppBudgetSummaryItem),
})

export type AppBudgetSummary = z.infer<typeof zAppBudgetSummary>

/** ===== family-care-leave ===== */
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

/** 目標の所有主体。 */
export const zAppGoalOwnerType = z.enum(["individual", "department", "company"])

/** 目標 1 件のレスポンス。 */
export const zAppGoal = z.object({
  id: z.number(),
  employee_id: z.number(),
  period: z.string(),
  title: z.string(),
  kpi: z.string().nullable(),
  weight: z.number(),
  status: z.string(),
  owner_type: zAppGoalOwnerType.default("individual"),
  parent_goal_id: z.number().nullable().default(null),
  department_code: z.string().nullable().default(null),
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

/** 目標ツリーのノード 1 件（children で再帰）。全社を根、部門を中間、個人目標を葉とする。 */
export type AppGoalTreeNode = {
  id: number
  employee_id: number
  period: string
  title: string
  kpi: string | null
  weight: number
  status: string
  owner_type: "individual" | "department" | "company"
  parent_goal_id: number | null
  department_code: string | null
  children: ReadonlyArray<AppGoalTreeNode>
}

export const zAppGoalTreeNode: z.ZodType<AppGoalTreeNode> = z.object({
  id: z.number(),
  employee_id: z.number(),
  period: z.string(),
  title: z.string(),
  kpi: z.string().nullable(),
  weight: z.number(),
  status: z.string(),
  owner_type: zAppGoalOwnerType,
  parent_goal_id: z.number().nullable(),
  department_code: z.string().nullable(),
  children: z.array(z.lazy(() => zAppGoalTreeNode)),
})

/** 目標ツリーのレスポンス（全社目標などのルートノード配列）。 */
export const zAppGoalTree = z.object({
  period: z.string().nullable(),
  roots: z.array(zAppGoalTreeNode),
})

export type AppGoalTree = z.infer<typeof zAppGoalTree>

/** 等級マスタ 1 件のレスポンス。 */
export const zAppGrade = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  rank: z.number(),
  description: z.string().nullable(),
  created_at: z.string(),
})

export type AppGrade = z.infer<typeof zAppGrade>

/** 等級マスタ一覧のレスポンス。 */
export const zAppGradeList = z.object({
  data: z.array(zAppGrade),
  total: z.number(),
})

export type AppGradeList = z.infer<typeof zAppGradeList>

/** 等級割当 1 件のレスポンス。 */
export const zAppEmployeeGrade = z.object({
  id: z.number(),
  employee_id: z.number(),
  grade_id: z.number(),
  effective_date: z.string(),
  reason: z.string().nullable(),
  created_at: z.string(),
  review_cycle_id: z.number().nullable(),
})

export type AppEmployeeGrade = z.infer<typeof zAppEmployeeGrade>

/** 等級割当履歴のレスポンス。 */
export const zAppEmployeeGradeList = z.object({
  data: z.array(zAppEmployeeGrade),
  total: z.number(),
})

export type AppEmployeeGradeList = z.infer<typeof zAppEmployeeGradeList>

/** 役職マスタ 1 件のレスポンス。 */
export const zAppPosition = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  rank: z.number(),
  description: z.string().nullable(),
  created_at: z.string(),
})

export type AppPosition = z.infer<typeof zAppPosition>

/** 役職マスタ一覧のレスポンス。 */
export const zAppPositionList = z.object({
  data: z.array(zAppPosition),
  total: z.number(),
})

export type AppPositionList = z.infer<typeof zAppPositionList>

/** 異動・在籍イベント 1 件のレスポンス。 */
export const zAppEmployeeEvent = z.object({
  id: z.number(),
  employee_id: z.number(),
  kind: z.string(),
  effective_date: z.string(),
  from_department_code: z.string().nullable(),
  to_department_code: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
})

export type AppEmployeeEvent = z.infer<typeof zAppEmployeeEvent>

/** 異動・在籍イベント履歴のレスポンス。 */
export const zAppEmployeeEventList = z.object({
  data: z.array(zAppEmployeeEvent),
  total: z.number(),
})

export type AppEmployeeEventList = z.infer<typeof zAppEmployeeEventList>

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

/** ナレッジ記事 1 件の詳細レスポンス（GET /knowledge-articles/:id）。 */
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

/** ナレッジ記事の作成・更新レスポンス（POST /knowledge-articles, PUT /knowledge-articles/:id）。 */
export const zAppKnowledgeWritten = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string(),
  tags: z.string().nullable(),
  body_md: z.string(),
})

export type AppKnowledgeWritten = z.infer<typeof zAppKnowledgeWritten>

/** 休暇申請 1 件のレスポンス（作成・承認・却下時）。approver_id と decided_comment を含む。 */
export const zAppLeaveRequest = z.object({
  id: z.number(),
  employee_id: z.number(),
  leave_type: leaveTypeSchema,
  start_date: z.string(),
  end_date: z.string(),
  days: z.number(),
  unit: leaveUnitSchema,
  hours: z.number().nullable(),
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
  leave_type: leaveTypeSchema,
  start_date: z.string(),
  end_date: z.string(),
  days: z.number(),
  unit: leaveUnitSchema,
  hours: z.number().nullable(),
  reason: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string(),
})

export type AppLeaveRequestDetail = z.infer<typeof zAppLeaveRequestDetail>

/** 本人の休暇申請一覧 1 件（GET /requests/me）。 */
export const zAppLeaveRequestSummary = z.object({
  id: z.number(),
  leave_type: leaveTypeSchema,
  start_date: z.string(),
  end_date: z.string(),
  days: z.number(),
  unit: leaveUnitSchema,
  hours: z.number().nullable(),
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
  leave_type: leaveTypeSchema,
  start_date: z.string(),
  end_date: z.string(),
  days: z.number(),
  unit: leaveUnitSchema,
  hours: z.number().nullable(),
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

/** 全社休暇申請一覧（GET /leave-requests/admin）の 1 件。 */
export const zAppLeaveRequestAdminItem = z.object({
  id: z.number(),
  applicant_id: z.number(),
  applicant_name: z.string(),
  applicant_dept_name: z.string().nullable(),
  leave_type: leaveTypeSchema,
  start_date: z.string(),
  end_date: z.string(),
  days: z.number(),
  unit: leaveUnitSchema,
  hours: z.number().nullable(),
  reason: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string(),
})

export type AppLeaveRequestAdminItem = z.infer<typeof zAppLeaveRequestAdminItem>

/** 全社休暇申請一覧（GET /leave-requests/admin）のレスポンス。 */
export const zAppLeaveRequestAdminList = z.object({
  data: z.array(zAppLeaveRequestAdminItem),
  total: z.number(),
})

export type AppLeaveRequestAdminList = z.infer<typeof zAppLeaveRequestAdminList>

/** 本人の休暇残数 1 件（GET /balance/me）。 */
export const zAppLeaveBalance = z.object({
  fiscal_year: z.string(),
  leave_type: leaveTypeSchema,
  granted_days: z.number(),
  used_days: z.number(),
  remaining_days: z.number(),
})

export type AppLeaveBalance = z.infer<typeof zAppLeaveBalance>

/** 本人の休暇残数一覧（GET /balance/me）。配列を直接返す（data/total ラップなし）。 */
export const zAppLeaveBalanceList = z.array(zAppLeaveBalance)

export type AppLeaveBalanceList = z.infer<typeof zAppLeaveBalanceList>

/** ===== life-event ===== */
export const zAppLifeEvent = z.object({
  id: z.string(),
  employee_id: z.number(),
  event_type: lifeEventTypeSchema,
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

/** ===== notification ===== */
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
  lifecycle_effect: z.enum(["hire", "retired"]).nullable(),
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

/** 直属部下 1 件のレスポンス。 */
export const zAppMyReport = z.object({
  code: z.string(),
  name: z.string(),
  dept_name: z.string().nullable(),
  position: z.string().nullable(),
})

export type AppMyReport = z.infer<typeof zAppMyReport>

/** 直属部下一覧のレスポンス（{ data }）。 */
export const zAppMyReportList = z.object({
  data: z.array(zAppMyReport),
})

export type AppMyReportList = z.infer<typeof zAppMyReportList>

/** 本人の所属部署 1 件のレスポンス（主配属を先頭に並べる）。 */
export const zAppMyDepartment = z.object({
  code: z.string(),
  name: z.string(),
  assignment_type: z.enum(["primary", "concurrent"]),
})

export type AppMyDepartment = z.infer<typeof zAppMyDepartment>

export const zAppMyDepartmentList = z.object({
  data: z.array(zAppMyDepartment),
})

export type AppMyDepartmentList = z.infer<typeof zAppMyDepartmentList>

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

/** ===== rental ===== */
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

/** ===== resignation ===== */
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
  visibility: z.string(),
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
  visibility: z.string(),
})

export type AppReviewFormSummary = z.infer<typeof zAppReviewFormSummary>

/** 自分宛て評価フォーム一覧のレスポンス。 */
export const zAppReviewFormList = z.object({
  data: z.array(zAppReviewFormSummary),
  total: z.number(),
})

export type AppReviewFormList = z.infer<typeof zAppReviewFormList>

/** 評価者種別ごとの提出状況（360度評価の集計）。 */
export const zAppReviewerTypeSummary = z.object({
  reviewer_type: z.string(),
  form_count: z.number(),
  submitted_count: z.number(),
})

export type AppReviewerTypeSummary = z.infer<typeof zAppReviewerTypeSummary>

/** 被評価者ごとの評価結果サマリのレスポンス。 */
export const zAppReviewResult = z.object({
  cycle_id: z.number(),
  subject_employee_id: z.number(),
  form_count: z.number(),
  submitted_count: z.number(),
  average_score: z.number().nullable(),
  reviewer_type_summary: z.array(zAppReviewerTypeSummary),
  forms: z.array(zAppReviewFormSummary),
})

export type AppReviewResult = z.infer<typeof zAppReviewResult>

/** 評価フォーム一括作成のレスポンス。作成された件数と各フォーム。 */
export const zAppReviewFormBulkResult = z.object({
  created_count: z.number(),
  forms: z.array(zAppReviewFormSummary),
})

export type AppReviewFormBulkResult = z.infer<typeof zAppReviewFormBulkResult>

/** サイクル一括開示のレスポンス。 */
export const zAppReviewDiscloseResult = z.object({
  cycle_id: z.number(),
  disclosed_count: z.number(),
})

export type AppReviewDiscloseResult = z.infer<typeof zAppReviewDiscloseResult>

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

/** 本人向けシフト割当 1 件のレスポンス。パターン名・時間帯を埋めて返す（member はパターン一覧を閲覧できないため）。 */
export const zAppMyShiftAssignment = z.object({
  id: z.number(),
  employee_id: z.number(),
  pattern_id: z.number().nullable(),
  pattern_name: z.string().nullable(),
  pattern_start_time: z.string().nullable(),
  pattern_end_time: z.string().nullable(),
  date: z.string(),
  note: z.string().nullable(),
  published_at: z.string().nullable(),
})

export type AppMyShiftAssignment = z.infer<typeof zAppMyShiftAssignment>

/** 本人向けシフト割当一覧のレスポンス。 */
export const zAppMyShiftAssignmentList = z.object({
  data: z.array(zAppMyShiftAssignment),
  total: z.number(),
})

export type AppMyShiftAssignmentList = z.infer<typeof zAppMyShiftAssignmentList>

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

/** 本人向けシフト交代申請 1 件のレスポンス。交代相手の氏名を埋めて返す（member は社員 ID から氏名を引けないため）。 */
export const zAppMyShiftSwapRequest = z.object({
  id: z.number(),
  requester_employee_id: z.number(),
  target_employee_id: z.number(),
  target_employee_name: z.string().nullable(),
  date: z.string(),
  note: z.string().nullable(),
  status: z.string(),
  approved_at: z.string().nullable(),
})

export type AppMyShiftSwapRequest = z.infer<typeof zAppMyShiftSwapRequest>

/** 本人向けシフト交代申請一覧のレスポンス。 */
export const zAppMyShiftSwapRequestList = z.object({
  data: z.array(zAppMyShiftSwapRequest),
  total: z.number(),
})

export type AppMyShiftSwapRequestList = z.infer<typeof zAppMyShiftSwapRequestList>

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

/** 全社シフト交代申請一覧（GET /shift-swap-requests/admin）の 1 件。社員名・部署も付与する。 */
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

/** ===== survey ===== */
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

/** ===== thanks ===== */
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

/** 全社サンクス交換申請一覧（GET /thanks-redemptions/admin）の 1 件。申請者名・景品名を含む。 */
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

/** 取引先 1 件のレスポンス。 */
export const zAppPartner = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  corporate_number: z.string().nullable(),
  note: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

export type AppPartner = z.infer<typeof zAppPartner>

/** 取引先一覧のレスポンス。 */
export const zAppPartnerList = z.object({
  data: z.array(zAppPartner),
  total: z.number(),
})

export type AppPartnerList = z.infer<typeof zAppPartnerList>

/** 契約記録 1 件のレスポンス。 */
export const zAppContract = z.object({
  id: z.number(),
  partner_id: z.number(),
  title: z.string(),
  contract_date: z.string(),
  starts_on: z.string().nullable(),
  ends_on: z.string().nullable(),
  renewal_deadline: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
})

export type AppContract = z.infer<typeof zAppContract>

/** 契約記録一覧のレスポンス。 */
export const zAppContractList = z.object({
  data: z.array(zAppContract),
  total: z.number(),
})

export type AppContractList = z.infer<typeof zAppContractList>

/** 会議体 1 件のレスポンス（詳細・作成・更新）。 */
export const zAppMeeting = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  cadence: z.string().nullable(),
  description: z.string().nullable(),
  status: z.enum(["active", "archived"]),
  created_at: z.string(),
})

export type AppMeeting = z.infer<typeof zAppMeeting>

/** 会議体一覧のレスポンス。 */
export const zAppMeetingList = z.object({
  data: z.array(zAppMeeting),
  total: z.number(),
})

export type AppMeetingList = z.infer<typeof zAppMeetingList>

/** 議事録 1 件のレスポンス（詳細・作成・更新）。 */
export const zAppMeetingMinutes = z.object({
  id: z.number(),
  meeting_id: z.number(),
  held_on: z.string(),
  title: z.string(),
  attendees: z.string().nullable(),
  body_md: z.string(),
  author_employee_id: z.number(),
  created_at: z.string(),
})

export type AppMeetingMinutes = z.infer<typeof zAppMeetingMinutes>

/** 議事録一覧のレスポンス。 */
export const zAppMeetingMinutesList = z.object({
  data: z.array(zAppMeetingMinutes),
  total: z.number(),
})

export type AppMeetingMinutesList = z.infer<typeof zAppMeetingMinutesList>

/** 意思決定記録 1 件のレスポンス（詳細・作成・更新・supersede）。 */
export const zAppDecision = z.object({
  id: z.number(),
  title: z.string(),
  decided_on: z.string(),
  context: z.string(),
  decision: z.string(),
  consequences: z.string().nullable(),
  status: z.enum(["active", "superseded"]),
  superseded_by_id: z.number().nullable(),
  created_at: z.string(),
})

export type AppDecision = z.infer<typeof zAppDecision>

/** 意思決定記録一覧のレスポンス。 */
export const zAppDecisionList = z.object({
  data: z.array(zAppDecision),
  total: z.number(),
})

export type AppDecisionList = z.infer<typeof zAppDecisionList>

/** 会社カレンダーの 1 日（会社休日 / 振替出勤日）。通常営業日は含まない。 */
export const zAppCompanyCalendarDay = z.object({
  id: z.number(),
  calendar_date: z.string(),
  kind: z.enum(["holiday", "workday"]),
  name: z.string().nullable(),
  created_at: z.string(),
})

export type AppCompanyCalendarDay = z.infer<typeof zAppCompanyCalendarDay>

/** 会社カレンダー一覧のレスポンス。 */
export const zAppCompanyCalendarDayList = z.object({
  data: z.array(zAppCompanyCalendarDay),
  total: z.number(),
})

export type AppCompanyCalendarDayList = z.infer<typeof zAppCompanyCalendarDayList>

/** 従業員の勤務形態の 1 区分（期間つき）。制度の適法性判定はしない。 */
export const zAppEmployeeWorkStyle = z.object({
  id: z.number(),
  employee_id: z.number(),
  style: z.enum(["regular", "flextime", "discretionary", "shift"]),
  starts_on: z.string(),
  ends_on: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
})

export type AppEmployeeWorkStyle = z.infer<typeof zAppEmployeeWorkStyle>

/** 従業員の勤務形態一覧のレスポンス。 */
export const zAppEmployeeWorkStyleList = z.object({
  data: z.array(zAppEmployeeWorkStyle),
  total: z.number(),
})

export type AppEmployeeWorkStyleList = z.infer<typeof zAppEmployeeWorkStyleList>

/** 従業員ごとの時間外の参考集計。1 日 8 時間×営業日を超えた分の合計（法定判定ではない参考値）。 */
export const zAppOvertimeSummaryEntry = z.object({
  employee_id: z.number(),
  work_days: z.number(),
  total_work_minutes: z.number(),
  overtime_minutes: z.number(),
})

export type AppOvertimeSummaryEntry = z.infer<typeof zAppOvertimeSummaryEntry>

/** 月内の時間外の集計表示のレスポンス。note は「法定判定ではない参考集計」である旨の説明。 */
export const zAppOvertimeSummary = z.object({
  month: z.string(),
  business_days: z.number(),
  daily_regular_minutes: z.number(),
  entries: z.array(zAppOvertimeSummaryEntry),
  note: z.string(),
})

export type AppOvertimeSummary = z.infer<typeof zAppOvertimeSummary>

/** 社内アナウンス一覧の 1 件。 */
export const zAppAnnouncementListItem = z.object({
  id: z.number(),
  title: z.string(),
  status: z.string(),
  published_on: z.string().nullable(),
  author_employee_id: z.number(),
  created_at: z.string(),
})

export type AppAnnouncementListItem = z.infer<typeof zAppAnnouncementListItem>

/** 社内アナウンス一覧のレスポンス。 */
export const zAppAnnouncementList = z.object({
  data: z.array(zAppAnnouncementListItem),
  total: z.number(),
})

export type AppAnnouncementList = z.infer<typeof zAppAnnouncementList>

/** 社内アナウンス 1 件の詳細・作成・更新レスポンス。 */
export const zAppAnnouncement = z.object({
  id: z.number(),
  title: z.string(),
  body_md: z.string(),
  status: z.string(),
  published_on: z.string().nullable(),
  author_employee_id: z.number(),
  created_at: z.string(),
})

export type AppAnnouncement = z.infer<typeof zAppAnnouncement>

/** 規程集一覧の 1 件（最新版のメタ情報を含む）。 */
export const zAppRegulationListItem = z.object({
  id: z.number(),
  code: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  status: z.string(),
  latest_version: z.number().nullable(),
  effective_on: z.string().nullable(),
  created_at: z.string(),
})

export type AppRegulationListItem = z.infer<typeof zAppRegulationListItem>

/** 規程集一覧のレスポンス。 */
export const zAppRegulationList = z.object({
  data: z.array(zAppRegulationListItem),
  total: z.number(),
})

export type AppRegulationList = z.infer<typeof zAppRegulationList>

/** 規程の改定版 1 件。 */
export const zAppRegulationVersion = z.object({
  id: z.number(),
  version: z.number(),
  body_md: z.string(),
  effective_on: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
})

export type AppRegulationVersion = z.infer<typeof zAppRegulationVersion>

/** 規程 1 件の詳細（最新版＋版一覧）。 */
export const zAppRegulationDetail = z.object({
  id: z.number(),
  code: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
  latest_version: zAppRegulationVersion.nullable(),
  versions: z.array(zAppRegulationVersion),
})

export type AppRegulationDetail = z.infer<typeof zAppRegulationDetail>

/** 規程の新規登録・新版追加・アーカイブのレスポンス（規程本体のメタ）。 */
export const zAppRegulation = z.object({
  id: z.number(),
  code: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

export type AppRegulation = z.infer<typeof zAppRegulation>

/** 文書台帳一覧の 1 件。 */
export const zAppDocumentListItem = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string().nullable(),
  location: z.string(),
  partner_code: z.string().nullable(),
  expires_on: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
})

export type AppDocumentListItem = z.infer<typeof zAppDocumentListItem>

/** 文書台帳一覧のレスポンス。 */
export const zAppDocumentList = z.object({
  data: z.array(zAppDocumentListItem),
  total: z.number(),
})

export type AppDocumentList = z.infer<typeof zAppDocumentList>

/** 文書台帳 1 件の作成・更新レスポンス。 */
export const zAppDocument = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string().nullable(),
  location: z.string(),
  partner_code: z.string().nullable(),
  expires_on: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
})

export type AppDocument = z.infer<typeof zAppDocument>

/** ライセンス・SaaS 台帳 1 件のレスポンス。 */
export const zAppLicense = z.object({
  id: z.number(),
  name: z.string(),
  vendor: z.string().nullable(),
  category: z.string().nullable(),
  seats: z.number().nullable(),
  renewal_deadline: z.string().nullable(),
  owner_employee_id: z.number().nullable(),
  note: z.string().nullable(),
  status: z.enum(["active", "cancelled"]),
  created_at: z.string(),
})

export type AppLicense = z.infer<typeof zAppLicense>

/** ライセンス・SaaS 台帳一覧のレスポンス。 */
export const zAppLicenseList = z.object({
  data: z.array(zAppLicense),
  total: z.number(),
})

export type AppLicenseList = z.infer<typeof zAppLicenseList>

/** インシデント記録 1 件のレスポンス。 */
export const zAppItIncident = z.object({
  id: z.number(),
  occurred_at: z.string(),
  title: z.string(),
  summary: z.string(),
  severity: z.string().nullable(),
  status: z.enum(["open", "resolved"]),
  resolved_at: z.string().nullable(),
  created_at: z.string(),
})

export type AppItIncident = z.infer<typeof zAppItIncident>

/** インシデント記録一覧のレスポンス。 */
export const zAppItIncidentList = z.object({
  data: z.array(zAppItIncident),
  total: z.number(),
})

export type AppItIncidentList = z.infer<typeof zAppItIncidentList>

/** 給与改定記録 1 件のレスポンス。基本給・前回基本給・適用日の事実のみ。 */
export const zAppSalaryRevision = z.object({
  id: z.number(),
  employee_id: z.number(),
  effective_date: z.string(),
  previous_base_salary: z.number(),
  new_base_salary: z.number(),
  reason: z.string().nullable(),
  created_at: z.string(),
})

export type AppSalaryRevision = z.infer<typeof zAppSalaryRevision>

/** 給与改定記録一覧のレスポンス。 */
export const zAppSalaryRevisionList = z.object({
  data: z.array(zAppSalaryRevision),
  total: z.number(),
})

export type AppSalaryRevisionList = z.infer<typeof zAppSalaryRevisionList>

/** 資格マスタ 1 件のレスポンス。 */
export const zAppCertification = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  issuer: z.string().nullable(),
  description: z.string().nullable(),
  created_at: z.string(),
})

export type AppCertification = z.infer<typeof zAppCertification>

/** 資格マスタ一覧のレスポンス。 */
export const zAppCertificationList = z.object({
  data: z.array(zAppCertification),
  total: z.number(),
})

export type AppCertificationList = z.infer<typeof zAppCertificationList>

/** 従業員の資格保有記録 1 件のレスポンス。 */
export const zAppEmployeeCertification = z.object({
  id: z.number(),
  employee_id: z.number(),
  certification_id: z.number(),
  acquired_on: z.string(),
  expires_on: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
})

export type AppEmployeeCertification = z.infer<typeof zAppEmployeeCertification>

/** 資格保有記録一覧のレスポンス。 */
export const zAppEmployeeCertificationList = z.object({
  data: z.array(zAppEmployeeCertification),
  total: z.number(),
})

export type AppEmployeeCertificationList = z.infer<typeof zAppEmployeeCertificationList>

/** 健診・ストレスチェック実施記録 1 件のレスポンス。結果は持たない。 */
export const zAppHealthCheckup = z.object({
  id: z.number(),
  employee_id: z.number(),
  fiscal_year: z.number(),
  checkup_kind: z.string(),
  conducted_on: z.string().nullable(),
  status: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
})

export type AppHealthCheckup = z.infer<typeof zAppHealthCheckup>

/** 健診実施記録一覧のレスポンス。 */
export const zAppHealthCheckupList = z.object({
  data: z.array(zAppHealthCheckup),
  total: z.number(),
})

export type AppHealthCheckupList = z.infer<typeof zAppHealthCheckupList>

/** 労災・事故の発生記録 1 件のレスポンス。 */
export const zAppWorkAccident = z.object({
  id: z.number(),
  occurred_on: z.string(),
  employee_id: z.number().nullable(),
  location: z.string().nullable(),
  summary: z.string(),
  severity: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

export type AppWorkAccident = z.infer<typeof zAppWorkAccident>

/** 労災・事故の発生記録一覧のレスポンス。 */
export const zAppWorkAccidentList = z.object({
  data: z.array(zAppWorkAccident),
  total: z.number(),
})

export type AppWorkAccidentList = z.infer<typeof zAppWorkAccidentList>

/** 募集ポジション 1 件のレスポンス。 */
export const zAppRecruitmentPosition = z.object({
  id: z.number(),
  title: z.string(),
  department_code: z.string().nullable(),
  status: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
})

export type AppRecruitmentPosition = z.infer<typeof zAppRecruitmentPosition>

/** 募集ポジション一覧のレスポンス。 */
export const zAppRecruitmentPositionList = z.object({
  data: z.array(zAppRecruitmentPosition),
  total: z.number(),
})

export type AppRecruitmentPositionList = z.infer<typeof zAppRecruitmentPositionList>

/** 応募者 1 件のレスポンス（社外個人情報。閲覧も recruitment:manage に閉じる）。 */
export const zAppRecruitmentCandidate = z.object({
  id: z.number(),
  position_id: z.number(),
  name: z.string(),
  email: z.string().nullable(),
  source: z.string().nullable(),
  stage: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
})

export type AppRecruitmentCandidate = z.infer<typeof zAppRecruitmentCandidate>

/** 応募者一覧のレスポンス。 */
export const zAppRecruitmentCandidateList = z.object({
  data: z.array(zAppRecruitmentCandidate),
  total: z.number(),
})

export type AppRecruitmentCandidateList = z.infer<typeof zAppRecruitmentCandidateList>

/** 表彰の記録 1 件のレスポンス（社内公開）。 */
export const zAppCommendation = z.object({
  id: z.number(),
  employee_id: z.number(),
  title: z.string(),
  reason: z.string(),
  awarded_on: z.string(),
  created_at: z.string(),
})

export type AppCommendation = z.infer<typeof zAppCommendation>

/** 表彰の記録一覧のレスポンス。 */
export const zAppCommendationList = z.object({
  data: z.array(zAppCommendation),
  total: z.number(),
})

export type AppCommendationList = z.infer<typeof zAppCommendationList>

/** 懲戒の記録 1 件のレスポンス（非公開。本人にも見せない設計）。 */
export const zAppDisciplinaryAction = z.object({
  id: z.number(),
  employee_id: z.number(),
  kind: z.string(),
  summary: z.string(),
  decided_on: z.string(),
  created_at: z.string(),
})

export type AppDisciplinaryAction = z.infer<typeof zAppDisciplinaryAction>

/** 懲戒の記録一覧のレスポンス。 */
export const zAppDisciplinaryActionList = z.object({
  data: z.array(zAppDisciplinaryAction),
  total: z.number(),
})

export type AppDisciplinaryActionList = z.infer<typeof zAppDisciplinaryActionList>

/** 人員計画 1 件のレスポンス。actual_count は同部署の active 在籍数。 */
export const zAppHeadcountPlan = z.object({
  id: z.number(),
  fiscal_year: z.number(),
  department_code: z.string().nullable(),
  planned_count: z.number(),
  actual_count: z.number(),
  note: z.string().nullable(),
  created_at: z.string(),
})

export type AppHeadcountPlan = z.infer<typeof zAppHeadcountPlan>

/** 人員計画一覧のレスポンス。 */
export const zAppHeadcountPlanList = z.object({
  data: z.array(zAppHeadcountPlan),
  total: z.number(),
})

export type AppHeadcountPlanList = z.infer<typeof zAppHeadcountPlanList>
/** 監査イベント一覧の legacy-tolerant な公開投影。 */
export const zAppAuditEventSummary = z.strictObject({
  event_id: z.string(),
  request_id: z.string(),
  actor_account_id: z.number().int().safe().nullable(),
  actor_employee_id: z.number().int().safe().nullable(),
  action: z.string(),
  target_type: z.string().nullable(),
  target_id: z.string().nullable(),
  outcome: z.enum(["succeeded", "denied", "failed"]),
  reason_code: z.string().nullable(),
  client_name: z.enum(["web", "cli", "api", "system"]),
  created_at: z.string(),
})

export type AppAuditEventSummary = z.infer<typeof zAppAuditEventSummary>

/** GET /audit-events の cursor page。 */
export const zAppAuditEventPage = z.strictObject({
  data: z.array(zAppAuditEventSummary),
  next_cursor: z.string().nullable(),
  previous_cursor: z.string().nullable(),
})

export type AppAuditEventPage = z.infer<typeof zAppAuditEventPage>

/** 監査イベント一件の保存文字列を維持する公開詳細投影。 */
export const zAppAuditEventDetail = zAppAuditEventSummary.extend({
  authorization_json: z.string().nullable(),
  before_json: z.string().nullable(),
  after_json: z.string().nullable(),
  metadata_json: z.string().nullable(),
  client_ip: z.string().nullable(),
})

export type AppAuditEventDetail = z.infer<typeof zAppAuditEventDetail>
