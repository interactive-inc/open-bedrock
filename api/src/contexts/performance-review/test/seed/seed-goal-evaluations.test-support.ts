import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
type SeedGoalEvaluation = {
  id: number
  goalId: number
  evaluatorId: EmployeeId
  kind: "self" | "manager" | "final"
  score: number | null
  comment: string | null
  createdAt: string
}

export const seedGoalEvaluations: ReadonlyArray<SeedGoalEvaluation> = [
  {
    id: 1,
    goalId: 4,
    evaluatorId: toWorkforceEmployeeId(9),
    kind: "self",
    score: 90,
    comment: "計画通り自動化を完了した",
    createdAt: "2026-01-10T09:00:00Z",
  },
  {
    id: 2,
    goalId: 4,
    evaluatorId: toWorkforceEmployeeId(4),
    kind: "manager",
    score: 85,
    comment: "品質が安定しており良い成果",
    createdAt: "2026-01-15T09:00:00Z",
  },
  {
    id: 3,
    goalId: 4,
    evaluatorId: toWorkforceEmployeeId(4),
    kind: "final",
    score: 88,
    comment: "最終評価A",
    createdAt: "2026-01-20T09:00:00Z",
  },
]
