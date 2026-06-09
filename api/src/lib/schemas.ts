import { z } from "zod"

// YYYY-MM-DD 形式の ISO 日付。"2026/13/45" や "tomorrow"、桁の揃わない "2026-1-1" を弾く。
// 月日の妥当性（例: 2026-13-01）までは Zod では検証しない。手前で形式不揃いを止め、
// 後段（ドメイン/DB）で「2026-1」と「2026-01」が別物として通る不整合を防ぐのが主目的。
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式で入力してください")

// YYYY-MM 形式の月次期間。payslip の (employee_id, period) 一意索引が
// 「2026-1」と「2026-01」を別キーとして取り込んでしまうのを防ぐ。
export const yearMonth = z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM 形式で入力してください")
