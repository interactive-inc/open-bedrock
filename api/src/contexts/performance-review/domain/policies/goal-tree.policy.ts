import type { Goal } from "@/contexts/performance-review/domain/entities/goal.entity"
import type { AppGoalTreeNode } from "@/lib/app-schemas"

export type Props = {
  /** 表示対象の目標(閲覧不可の個人目標は事前に除外済みであること)。 */
  goals: ReadonlyArray<Goal>
}

/** 目標 1 件を子なしのツリーノードに写す。 */
function toNode(goal: Goal): AppGoalTreeNode {
  return {
    id: goal.id ?? 0,
    employee_id: goal.employeeId,
    period: goal.period,
    title: goal.title,
    kpi: goal.kpi,
    weight: goal.weight,
    status: goal.status,
    owner_type: goal.ownerType,
    parent_goal_id: goal.parentGoalId,
    department_code: goal.departmentCode,
    children: [],
  }
}

/** 親候補が存在し、かつ親が自分より上位の階層(company>department>individual)なら親 id を返す。 */
function toParentId(goal: Goal, nodesById: Map<number, AppGoalTreeNode>): number | null {
  if (goal.parentGoalId === null) {
    return null
  }

  return nodesById.has(goal.parentGoalId) ? goal.parentGoalId : null
}

/**
 * 目標の集合を parent_goal_id で全社→部門→個人のツリーに組む。
 * 親が集合内に無い目標はルートとして扱う。循環は id ベースの走査で作らない。
 */
export function buildGoalTree(props: Props): ReadonlyArray<AppGoalTreeNode> {
  const nodesById = new Map<number, AppGoalTreeNode>()

  for (const goal of props.goals) {
    if (goal.id !== null) {
      nodesById.set(goal.id, toNode(goal))
    }
  }

  const roots: Array<AppGoalTreeNode> = []

  for (const goal of props.goals) {
    if (goal.id === null) {
      continue
    }

    const node = nodesById.get(goal.id)

    if (node === undefined) {
      continue
    }

    const parentId = toParentId(goal, nodesById)

    if (parentId === null || parentId === goal.id) {
      roots.push(node)

      continue
    }

    const parent = nodesById.get(parentId)

    if (parent === undefined) {
      roots.push(node)

      continue
    }

    parent.children = [...parent.children, node]
  }

  return roots
}
