// 分を「Hh Mm」形式の表示用ラベルへ変換する純粋関数。null は "-" を返す。
export function toDurationLabel(minutes: number | null): string {
  if (minutes === null) {
    return "-"
  }

  const hours = Math.floor(minutes / 60)

  const rest = minutes % 60

  return `${hours}h ${rest}m`
}
