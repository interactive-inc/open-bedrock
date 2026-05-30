export type SeedOneOnOne = {
  id: string
  memberId: number
  managerId: number
  heldAt: string
  topics: string | null
  managerNote: string | null
  nextAction: string | null
}

export const seedOneOnOnes: ReadonlyArray<SeedOneOnOne> = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    memberId: 5,
    managerId: 4,
    heldAt: "2026-05-01T05:00:00Z",
    topics: "Goal progress and career direction",
    managerNote: "Promising candidate for a lead role",
    nextAction: "Assign ownership of the next design review",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    memberId: 3,
    managerId: 4,
    heldAt: "2026-05-08T05:00:00Z",
    topics: "Test coverage targets",
    managerNote: "On track; keep monitoring workload",
    nextAction: "Share progress weekly",
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    memberId: 10,
    managerId: 9,
    heldAt: "2026-05-12T06:00:00Z",
    topics: "New customer acquisition strategy",
    managerNote: "Agreed to narrow the target accounts",
    nextAction: "Draft a priority account list",
  },
]
