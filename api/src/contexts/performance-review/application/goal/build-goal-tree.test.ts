import { describe, expect, test } from "bun:test"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { Goal } from "@/contexts/performance-review/domain/entities/goal.entity"
import { buildGoalTree } from "@/contexts/performance-review/domain/policies/goal-tree.policy"
import type { GoalOwnerType } from "@/contexts/performance-review/domain/entities/goal.entity"

/** テスト用の目標を組み立てる。 */
function goal(props: { id: string; ownerType: GoalOwnerType; parentGoalId: string | null }): Goal {
  return Goal.fromRow({
    id: props.id,
    employeeId: toWorkforceEmployeeId(1),
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
        goal({
          id: "01900030-0000-7000-8000-000000000001",
          ownerType: "company",
          parentGoalId: null,
        }),
        goal({
          id: "01900030-0000-7000-8000-000000000002",
          ownerType: "department",
          parentGoalId: "01900030-0000-7000-8000-000000000001",
        }),
        goal({
          id: "01900030-0000-7000-8000-000000000003",
          ownerType: "individual",
          parentGoalId: "01900030-0000-7000-8000-000000000002",
        }),
      ],
    })

    expect(roots.length).toBe(1)
    expect(roots[0]?.id).toBe("01900030-0000-7000-8000-000000000001")
    expect(roots[0]?.children[0]?.id).toBe("01900030-0000-7000-8000-000000000002")
    expect(roots[0]?.children[0]?.children[0]?.id).toBe("01900030-0000-7000-8000-000000000003")
  })

  test("treats goals whose parent is absent as roots", () => {
    const roots = buildGoalTree({
      goals: [
        goal({
          id: "01900030-0000-7000-8000-000000000002",
          ownerType: "department",
          parentGoalId: "01900030-0000-7000-8000-000000000063",
        }),
        goal({
          id: "01900030-0000-7000-8000-000000000003",
          ownerType: "individual",
          parentGoalId: null,
        }),
      ],
    })

    const rootIds = roots.map((node) => node.id).toSorted()

    expect(rootIds).toEqual([
      "01900030-0000-7000-8000-000000000002",
      "01900030-0000-7000-8000-000000000003",
    ])
  })
})
