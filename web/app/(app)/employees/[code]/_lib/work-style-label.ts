import type { WorkStyle } from "@/lib/api/types/work-style-types"

// 勤務形態の区分を表示用ラベルへ変換する純粋関数。
export function toWorkStyleLabel(style: WorkStyle): string {
  if (style === "flextime") {
    return "フレックスタイム制"
  }

  if (style === "discretionary") {
    return "裁量労働制"
  }

  if (style === "shift") {
    return "シフト制"
  }

  return "通常勤務"
}
