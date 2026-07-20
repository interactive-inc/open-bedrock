/**
 * review_forms 行の visibility カラムを型安全な値域に変換する。
 */
export function toVisibility(value: string): "hidden" | "disclosed" {
  return value === "hidden" ? "hidden" : "disclosed"
}
