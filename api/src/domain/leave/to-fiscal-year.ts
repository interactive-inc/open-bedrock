const jstOffsetMs = 9 * 60 * 60 * 1000

// 日本の会計年度（4 月始まり）を JST 基準で返す。1〜3 月は前年の年度に属する。
// UTC のまま月を見ると JST 4/1 0:00〜8:59 の操作が前年度扱いになるため、
// +9 時間して JST の暦に直してから判定する。解析できない日付は null。
// 例: JST 2027-01-15 → "2026"（2026/4〜2027/3 の年度）、JST 2026-04-01 → "2026"。
export function toFiscalYear(now: string): string | null {
  const parsed = new Date(now)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  const jst = new Date(parsed.getTime() + jstOffsetMs)

  const year = jst.getUTCFullYear()

  return jst.getUTCMonth() < 3 ? String(year - 1) : String(year)
}
