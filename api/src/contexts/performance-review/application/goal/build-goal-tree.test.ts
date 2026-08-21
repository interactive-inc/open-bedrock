import { describe, expect, test } from "bun:test"
import { Goal } from "@/contexts/performance-review/domain/entities/goal.entity"
import { buildGoalTree } from "@/contexts/performance-review/domain/policies/goal-tree.policy"
import type { GoalOwnerType } from "@/contexts/performance-review/domain/entities/goal.entity"

/** テスト用の目標を組み立てる。 */
function goal(props: { id: number; ownerType: GoalOwnerType; parentGoalId: number | null }): Goal {
  return Goal.fromRow({
    id: props.id,
    employeeId: 1,
    period: "2026-H1",
    title: `goal ${props.id}`,
    kpi: null,
    weight: 10,
    status: "in_progress",
    ownerType: props.ownerType,
    parentGoalId: props.parentGoalId,
    departmentCode: null,
    evaluationSheetId: null,
  })
}

describe("buildGoalTree", () => {
  test("nests company -> department -> individual by parent_goal_id", () => {
    const roots = buildGoalTree({
      goals: [
        goal({ id: 1, ownerType: "company", parentGoalId: null }),
        goal({ id: 2, ownerType: "department", parentGoalId: 1 }),
        goal({ id: 3, ownerType: "individual", parentGoalId: 2 }),
      ],
    })

    expect(roots.length).toBe(1)
    expect(roots[0]?.id).toBe(1)
    expect(roots[0]?.children[0]?.id).toBe(2)
    expect(roots[0]?.children[0]?.children[0]?.id).toBe(3)
  })

  test("treats goals whose parent is absent as roots", () => {
    const roots = buildGoalTree({
      goals: [
        goal({ id: 2, ownerType: "department", parentGoalId: 99 }),
        goal({ id: 3, ownerType: "individual", parentGoalId: null }),
      ],
    })

    const rootIds = roots.map((node) => node.id).sort((a, b) => a - b)

    expect(rootIds).toEqual([2, 3])
  })
})
