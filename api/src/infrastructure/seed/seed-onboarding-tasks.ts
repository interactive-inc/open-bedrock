type SeedOnboardingTask = {
  id: number
  assignmentId: number
  templateTaskCode: string
  title: string
  order: number
  status: "pending" | "done"
  completedAt: string | null
}

export const seedOnboardingTasks: ReadonlyArray<SeedOnboardingTask> = [
  {
    id: 200,
    assignmentId: 100,
    templateTaskCode: "issue_pc",
    title: "Issue a laptop",
    order: 1,
    status: "pending",
    completedAt: null,
  },
  {
    id: 201,
    assignmentId: 100,
    templateTaskCode: "create_account",
    title: "Create accounts",
    order: 2,
    status: "pending",
    completedAt: null,
  },
]
