/**
 * review_forms 行の status カラムを型安全な値域に変換する。
 */
export function toFormStatus(value: string): "pending" | "submitted" {
  return value === "submitted" ? "submitted" : "pending"
}
