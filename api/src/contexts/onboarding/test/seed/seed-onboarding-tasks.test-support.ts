type SeedOnboardingTask = {
  id: string
  assignmentId: string
  templateTaskCode: string
  title: string
  order: number
  status: "pending" | "done"
  completedAt: string | null
}

export const seedOnboardingTasks: ReadonlyArray<SeedOnboardingTask> = [
  {
    id: "0190003e-0000-7000-8000-0000000000c8",
    assignmentId: "0190003d-0000-7000-8000-000000000064",
    templateTaskCode: "issue_pc",
    title: "PCを貸与する",
    order: 1,
    status: "pending",
    completedAt: null,
  },
  {
    id: "0190003e-0000-7000-8000-0000000000c9",
    assignmentId: "0190003d-0000-7000-8000-000000000064",
    templateTaskCode: "create_account",
    title: "各種アカウントを作成する",
    order: 2,
    status: "pending",
    completedAt: null,
  },
]
