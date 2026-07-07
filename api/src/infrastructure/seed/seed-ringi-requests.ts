type SeedRingiRequest = {
  id: number
  applicantId: number
  approverId: number
  title: string
  amount: number
  reason: string
  status: "pending" | "approved" | "rejected"
  decidedAt: string | null
  decisionComment: string | null
  createdAt: string
}

// applicantId / approverId は seedEmployees に存在する社員に対応させる。
export const seedRingiRequests: ReadonlyArray<SeedRingiRequest> = [
  {
    id: 1,
    applicantId: 5,
    approverId: 4,
    title: "New CI vendor contract",
    amount: 240000,
    reason: "faster builds for the team",
    status: "pending",
    decidedAt: null,
    decisionComment: null,
    createdAt: "2026-05-11T01:00:00Z",
  },
  {
    id: 2,
    applicantId: 5,
    approverId: 4,
    title: "Conference sponsorship",
    amount: 500000,
    reason: "brand exposure",
    status: "approved",
    decidedAt: "2026-05-13T02:00:00Z",
    decisionComment: "approved within budget",
    createdAt: "2026-05-12T02:00:00Z",
  },
  {
    id: 3,
    applicantId: 10,
    approverId: 9,
    title: "New CRM seats",
    amount: 120000,
    reason: "sales team growth",
    status: "pending",
    decidedAt: null,
    decisionComment: null,
    createdAt: "2026-05-14T03:00:00Z",
  },
]
