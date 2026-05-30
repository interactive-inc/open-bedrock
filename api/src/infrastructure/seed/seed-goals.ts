type SeedGoal = {
  id: number
  employeeId: number
  period: string
  title: string
  kpi: string | null
  weight: number
  status: string
}

export const seedGoals: ReadonlyArray<SeedGoal> = [
  {
    id: 1,
    employeeId: 5,
    period: "2026-H1",
    title: "Release the new dashboard feature",
    kpi: "Released with zero critical bugs",
    weight: 40,
    status: "in_progress",
  },
  {
    id: 2,
    employeeId: 5,
    period: "2026-H1",
    title: "Reduce code review turnaround time",
    kpi: "Average response within 4 hours",
    weight: 20,
    status: "in_progress",
  },
  {
    id: 3,
    employeeId: 9,
    period: "2026-H1",
    title: "Improve test coverage",
    kpi: "Coverage at or above 80%",
    weight: 30,
    status: "in_progress",
  },
  {
    id: 4,
    employeeId: 9,
    period: "2025-H2",
    title: "Set up the CI/CD pipeline",
    kpi: "Deployment fully automated",
    weight: 50,
    status: "completed",
  },
  {
    id: 5,
    employeeId: 10,
    period: "2026-H1",
    title: "Acquire ten new customers",
    kpi: "Ten signed deals",
    weight: 60,
    status: "in_progress",
  },
  {
    id: 6,
    employeeId: 10,
    period: "2026-H1",
    title: "Lower the churn rate of existing customers",
    kpi: "Churn rate below 5%",
    weight: 20,
    status: "draft",
  },
  {
    id: 7,
    employeeId: 13,
    period: "2026-H1",
    title: "Refresh the onboarding material",
    kpi: "Material renewal completed",
    weight: 30,
    status: "in_progress",
  },
  {
    id: 8,
    employeeId: 3,
    period: "2026-H1",
    title: "Improve the hiring process",
    kpi: "Screening lead time cut by 30%",
    weight: 40,
    status: "draft",
  },
]
