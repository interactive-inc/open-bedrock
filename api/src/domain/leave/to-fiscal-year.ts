// 日本の会計年度（4 月始まり）を返す。1〜3 月は前年の年度に属する。
// 例: 2027-01-15 → "2026"（2026/4〜2027/3 の年度）、2026-04-01 → "2026"。
export function toFiscalYear(now: string): string {
  const parsed = new Date(now)

  const year = parsed.getUTCFullYear()

  if (Number.isNaN(year)) {
    return ""
  }

  return parsed.getUTCMonth() < 3 ? String(year - 1) : String(year)
}
