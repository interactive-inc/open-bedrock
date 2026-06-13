import { z } from "zod"

// YYYY-MM-DD 形式かつ実在する ISO 日付。"2026/13/45" や "tomorrow"、桁の揃わない "2026-1-1"
// を弾くほか、"2026-02-30" のような存在しない日付も弾く。後者は Date が翌月へロールオーバーし、
// 休暇日数の算出（to-leave-days）などで誤った有限値を生むため、形式段階で止める。
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式で入力してください")
  .refine(isRealCalendarDate, "実在する日付を入力してください")

// 正規表現を通った YYYY-MM-DD が実在する日付か検証する。UTC で組み立て直し、
// 年・月・日が入力と一致すれば（=ロールオーバーしていなければ）実在する日付とみなす。
function isRealCalendarDate(value: string): boolean {
  const year = Number(value.slice(0, 4))

  const month = Number(value.slice(5, 7))

  const day = Number(value.slice(8, 10))

  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

// YYYY-MM 形式の月次期間。payslip の (employee_id, period) 一意索引が
// 「2026-1」と「2026-01」を別キーとして取り込んでしまうのを防ぐ。
export const yearMonth = z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM 形式で入力してください")

// コード・識別子フィールド共通。空文字と長すぎる値を弾く。
export const codeSchema = z.string().min(1).max(200)

// 従業員ロール。API 入力で許容する値を列挙する。
export const employeeRoleSchema = z.enum(["member", "manager", "hr", "admin"])

export type EmployeeRole = z.infer<typeof employeeRoleSchema>
