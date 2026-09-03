import type { GoalTreeNode } from "@/app/(app)/performance-review/goals/tree/_lib/goal-tree-types"

export type FlatGoalRow = {
  id: number
  depth: number
  title: string
  ownerType: GoalTreeNode["owner_type"]
  status: string
  weight: number
  departmentCode: string | null
  employeeId: string
}

/** ツリーを深さ付きの平坦な行に展開する。インデント表示用。親→子の順で並ぶ。 */
export function toFlatGoalRows(
  nodes: ReadonlyArray<GoalTreeNode>,
  depth = 0,
): ReadonlyArray<FlatGoalRow> {
  const rows: Array<FlatGoalRow> = []

  for (const node of nodes) {
    rows.push({
      id: node.id,
      depth: depth,
      title: node.title,
      ownerType: node.owner_type,
      status: node.status,
      weight: node.weight,
      departmentCode: node.department_code,
      employeeId: node.employee_id,
    })

    for (const child of toFlatGoalRows(node.children, depth + 1)) {
      rows.push(child)
    }
  }

  return rows
}
