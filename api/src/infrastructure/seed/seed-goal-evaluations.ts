type SeedGoalEvaluation = {
  id: number
  goalId: number
  evaluatorId: number
  kind: "self" | "manager" | "final"
  score: number | null
  comment: string | null
  createdAt: string
}

export const seedGoalEvaluations: ReadonlyArray<SeedGoalEvaluation> = [
  {
    id: 1,
    goalId: 4,
    evaluatorId: 9,
    kind: "self",
    score: 90,
    comment: "Automation completed as planned",
    createdAt: "2026-01-10T09:00:00Z",
  },
  {
    id: 2,
    goalId: 4,
    evaluatorId: 4,
    kind: "manager",
    score: 85,
    comment: "Quality stayed stable; strong result",
    createdAt: "2026-01-15T09:00:00Z",
  },
  {
    id: 3,
    goalId: 4,
    evaluatorId: 4,
    kind: "final",
    score: 88,
    comment: "Final rating A",
    createdAt: "2026-01-20T09:00:00Z",
  },
]
