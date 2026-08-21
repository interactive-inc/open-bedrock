type SeedOnboardingAssignment = {
  id: number
  employeeId: number
  templateCode: string
  kind: "join" | "leave"
  status: "in_progress" | "completed"
  assignedAt: string
}

export const seedOnboardingAssignments: ReadonlyArray<SeedOnboardingAssignment> = [
  {
    id: 100,
    employeeId: 5,
    templateCode: "engineer_join",
    kind: "join",
    status: "in_progress",
    assignedAt: "2026-05-29T00:00:00Z",
  },
]
