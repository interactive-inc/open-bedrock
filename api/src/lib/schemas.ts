import { z } from "zod"

/**
 * YYYY-MM-DD 形式かつ実在する ISO 日付。"2026/13/45" や "tomorrow"、桁の揃わない "2026-1-1"
 * を弾くほか、"2026-02-30" のような存在しない日付も弾く。後者は Date が翌月へロールオーバーし、
 * 休暇日数の算出（to-leave-days）などで誤った有限値を生むため、形式段階で止める。
 */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式で入力してください")
  .refine(isRealCalendarDate, "実在する日付を入力してください")

/**
 * 正規表現を通った YYYY-MM-DD が実在する日付か検証する。UTC で組み立て直し、
 * 年・月・日が入力と一致すれば（=ロールオーバーしていなければ）実在する日付とみなす。
 */
function isRealCalendarDate(value: string): boolean {
  const year = Number(value.slice(0, 4))

  const month = Number(value.slice(5, 7))

  const day = Number(value.slice(8, 10))

  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

/**
 * YYYY-MM 形式の月次期間。payslip の (employee_id, period) 一意索引が
 * 「2026-1」と「2026-01」を別キーとして取り込んでしまうのを防ぐ。
 */
export const yearMonth = z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM 形式で入力してください")

/** コード・識別子フィールド共通。空文字と長すぎる値を弾く。 */
export const codeSchema = z.string().min(1).max(200)

/** 従業員ロール。API 入力で許容する値を列挙する。 */
export const employeeRoleSchema = z.enum(["member", "manager", "hr", "root"])

export type EmployeeRole = z.infer<typeof employeeRoleSchema>

/** 従業員ステータス */
export const employeeStatusSchema = z.enum(["active", "leave", "retired"])

/** アカウントのステータス。suspended/locked は認証を拒否する。 */
export const accountStatusSchema = z.enum(["active", "suspended", "locked"])

export type AccountStatus = z.infer<typeof accountStatusSchema>

/** 認証 identity の方式。password 以外は OAuth/OIDC の拡張点。 */
export const identityProviderSchema = z.enum(["password", "google", "github", "oidc"])

export type IdentityProvider = z.infer<typeof identityProviderSchema>

export type EmployeeStatus = z.infer<typeof employeeStatusSchema>

/** 休暇種別 */
export const leaveTypeSchema = z.enum([
  "annual",
  "special",
  "compensatory",
  "summer",
  "child_nursing_care",
  "prenatal_checkup",
  "menstrual",
  "caregiving_leave",
])

export type LeaveType = z.infer<typeof leaveTypeSchema>

/** 休暇申請ステータス */
export const leaveStatusSchema = z.enum(["pending", "approved", "rejected"])

export type LeaveStatus = z.infer<typeof leaveStatusSchema>

/** 休暇申請の取得単位。hourly のときのみ hours を伴う。 */
export const leaveUnitSchema = z.enum(["full_day", "half_day_am", "half_day_pm", "hourly"])

export type LeaveUnit = z.infer<typeof leaveUnitSchema>

/** ライフイベント届出の種別 */
export const lifeEventTypeSchema = z.enum([
  "marriage",
  "divorce",
  "childbirth",
  "relocation",
  "dependent_added",
  "dependent_removed",
])

export type LifeEventType = z.infer<typeof lifeEventTypeSchema>

/** バッチジョブステータス */
export const batchJobStatusSchema = z.enum(["running", "completed", "failed"])

export type BatchJobStatus = z.infer<typeof batchJobStatusSchema>

/** 経費カテゴリ */
export const expenseCategorySchema = z.enum([
  "transport",
  "supplies",
  "entertainment",
  "books",
  "other",
])

export type ExpenseCategory = z.infer<typeof expenseCategorySchema>

/** 経費申請ステータス */
export const expenseStatusSchema = z.enum(["pending", "approved", "rejected", "settled"])

export type ExpenseStatus = z.infer<typeof expenseStatusSchema>

/** 経費承認アクション */
export const expenseApprovalActionSchema = z.enum(["approve", "reject"])

export type ExpenseApprovalAction = z.infer<typeof expenseApprovalActionSchema>

/** 稟議ステータス */
export const ringiStatusSchema = z.enum(["pending", "approved", "rejected"])

export type RingiStatus = z.infer<typeof ringiStatusSchema>

/** サンクスポイント交換ステータス */
export const redemptionStatusSchema = z.enum(["pending", "rejected", "fulfilled"])

export type RedemptionStatus = z.infer<typeof redemptionStatusSchema>

/** 会社カレンダーの日種別。holiday=会社休日、workday=振替出勤日。通常営業日は行を持たない。 */
export const calendarDayKindSchema = z.enum(["holiday", "workday"])

export type CalendarDayKind = z.infer<typeof calendarDayKindSchema>

/** 勤務形態の区分。制度の適法性判定はせず、区分の記録のみ。 */
export const workStyleSchema = z.enum(["regular", "flextime", "discretionary", "shift"])

export type WorkStyle = z.infer<typeof workStyleSchema>
