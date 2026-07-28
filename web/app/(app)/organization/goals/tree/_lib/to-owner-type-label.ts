import type { GoalTreeNode } from "@/app/(app)/organization/goals/tree/_lib/goal-tree-types"

/** 目標の所有主体を日本語ラベルに変換する。 */
export function toOwnerTypeLabel(ownerType: GoalTreeNode["owner_type"]): string {
  if (ownerType === "company") {
    return "全社"
  }

  if (ownerType === "department") {
    return "部門"
  }

  return "個人"
}
