type SeedCareerSheet = {
  employeeId: number
  goalsText: string | null
  strengthsText: string | null
  updatedAt: string
}

export const seedCareerSheets: ReadonlyArray<SeedCareerSheet> = [
  {
    employeeId: 5,
    goalsText: "Lead the overall architecture as a tech lead",
    strengthsText: "Strong design skills and quality improvement through code review",
    updatedAt: "2026-04-01T00:00:00Z",
  },
  {
    employeeId: 6,
    goalsText: "Broaden my scope as a full-stack engineer",
    strengthsText: "Frontend development and test automation",
    updatedAt: "2026-04-05T00:00:00Z",
  },
  {
    employeeId: 10,
    goalsText: "Aim to become a sales manager",
    strengthsText: "Customer negotiation and proposal skills",
    updatedAt: "2026-04-10T00:00:00Z",
  },
]
