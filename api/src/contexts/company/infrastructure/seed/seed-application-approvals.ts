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
    comment: "問題なし",
    createdAt: "2026-05-11T00:00:00Z",
  },
  {
    id: 2,
    applicationId: 4,
    approverId: 13,
    action: "reject",
    comment: "今期の予算を超過しているため",
    createdAt: "2026-05-06T00:00:00Z",
  },
]
