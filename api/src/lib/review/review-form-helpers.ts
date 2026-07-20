/**
 * review_forms 行の reviewer_type カラムを型安全な値域に変換する。
 * 以下のヘルパー群はドメイン層（ReviewForm.fromRow）と interface 層の読み取り GET で共有する
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

export function toFormStatus(value: string): "pending" | "submitted" {
  return value === "submitted" ? "submitted" : "pending"
}

export function toVisibility(value: string): "hidden" | "disclosed" {
  return value === "hidden" ? "hidden" : "disclosed"
}

export function toAnswers(value: string): ReadonlyArray<unknown> {
  try {
    const decoded: unknown = JSON.parse(value)

    return Array.isArray(decoded) ? decoded : []
  } catch {
    return []
  }
}
