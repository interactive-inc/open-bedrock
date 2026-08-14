import type {
  ApplicationWorkflow,
  ApplicationWorkflowStep,
} from "@/contexts/company/domain/application/application-workflow"

export type WorkflowApplicant = {
  /** 社員コード。外部プロビジョニングで作られた申請者は持たない（null）。条件照合では null は不一致になる。 */
  code: string | null
  id: number
  dept_id: number | null
  dept_name: string | null
  position: string | null
  status: string
}

/**
 * 適用条件を満たすワークフローステップを絞り込む。
 * 条件のないステップは常に適用。condition_mode が all なら全条件成立、それ以外は一つでも成立で適用
 */
export function applicableWorkflowSteps(props: {
  workflow: ApplicationWorkflow
  payload: unknown
  applicant: WorkflowApplicant
}): ReadonlyArray<ApplicationWorkflowStep> {
  return props.workflow.steps.filter((step) => {
    if (step.conditions.length === 0) return true

    const results = step.conditions.map((condition) => {
      const source = condition.source === "payload" ? props.payload : props.applicant
      const actual = readPath(source, condition.field)

      return compare(actual, condition.operator, condition.value)
    })

    return step.condition_mode === "all" ? results.every(Boolean) : results.some(Boolean)
  })
}

function readPath(value: unknown, path: string): unknown {
  let current = value

  for (const segment of path.split(".")) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) return undefined
    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

function compare(
  actual: unknown,
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "exists",
  expected: unknown,
): boolean {
  if (operator === "exists") return actual !== undefined && actual !== null
  if (operator === "eq") return actual === expected
  if (operator === "neq") return actual !== expected
  if (operator === "in") return Array.isArray(expected) && expected.includes(actual)

  if (typeof actual !== "number" || typeof expected !== "number") return false

  if (operator === "gt") return actual > expected
  if (operator === "gte") return actual >= expected
  if (operator === "lt") return actual < expected

  return actual <= expected
}
