type SeedApplicationApproval = {
  id: number
  applicationId: number
  approverId: number
  action: "approve" | "reject"
  comment: string | null
  createdAt: string
}

export const seedApplicationApprovals: ReadonlyArray<SeedApplicationApproval> = [
  {
    id: 1,
    applicationId: 3,
    approverId: 4,
    action: "approve",
    comment: "no issues",
    createdAt: "2026-05-11T00:00:00Z",
  },
  {
    id: 2,
    applicationId: 4,
    approverId: 13,
    action: "reject",
    comment: "over budget for this term",
    createdAt: "2026-05-06T00:00:00Z",
  },
]
