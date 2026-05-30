// パスパラメータの文字列を正の整数 ID に変換する。不正なら null。
export function toExpenseId(raw: string): number | null {
  const parsed = Number(raw)

  if (Number.isInteger(parsed) === false) {
    return null
  }

  if (parsed <= 0) {
    return null
  }

  return parsed
}
