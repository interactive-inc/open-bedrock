/**
 * review_forms 行の reviewer_type カラムを型安全な値域に変換する。
 * ドメイン層（ReviewForm.fromRow）と interface 層の読み取り GET で共有する。
 */
export function toReviewerType(value: string): "self" | "manager" | "peer" | "subordinate" {
  if (value === "manager") {
    return "manager"
  }

  if (value === "peer") {
    return "peer"
  }

  if (value === "subordinate") {
    return "subordinate"
  }

  return "self"
}
