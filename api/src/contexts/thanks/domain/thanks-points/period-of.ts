/**
 * ISO 文字列の日時から YYYY-MM の period を切り出す純粋関数。
 * createdAt は常に ISO 8601（例: 2026-01-01T00:00:00.000Z）で渡る前提。
 */
export function periodOf(isoDateTime: string): string {
  return isoDateTime.slice(0, 7)
}
