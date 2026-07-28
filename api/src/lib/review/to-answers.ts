/**
 * review_forms 行の answers カラム（JSON 文字列）を配列に復元する。
 * 配列でない・壊れた JSON は空配列に倒す。
 */
export function toAnswers(value: string): ReadonlyArray<unknown> {
  try {
    const decoded: unknown = JSON.parse(value)

    return Array.isArray(decoded) ? decoded : []
  } catch {
    return []
  }
}
