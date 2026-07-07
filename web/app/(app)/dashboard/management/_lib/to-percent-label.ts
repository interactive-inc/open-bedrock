// 0-1 の比率を百分率の表示ラベルに整える（例: 0.333 -> "33%"）。
export function toPercentLabel(rate: number): string {
  return `${Math.round(rate * 100)}%`
}
