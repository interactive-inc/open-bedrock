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

/** applicantId / approverId は seedEmployees に存在する社員に対応させる。 */
export const seedRingiRequests: ReadonlyArray<SeedRingiRequest> = [
  {
    id: 1,
    applicantId: 5,
    approverId: 4,
    title: "新しいCIベンダーとの契約",
    amount: 240000,
    reason: "チームのビルド高速化のため",
    status: "pending",
    decidedAt: null,
    decisionComment: null,
    createdAt: "2026-05-11T01:00:00Z",
  },
  {
    id: 2,
    applicantId: 5,
    approverId: 4,
    title: "カンファレンス協賛",
    amount: 500000,
    reason: "ブランド露出のため",
    status: "approved",
    decidedAt: "2026-05-13T02:00:00Z",
    decisionComment: "予算内のため承認",
    createdAt: "2026-05-12T02:00:00Z",
  },
  {
    id: 3,
    applicantId: 10,
    approverId: 9,
    title: "CRMの追加ライセンス",
    amount: 120000,
    reason: "営業チームの増員のため",
    status: "pending",
    decidedAt: null,
    decisionComment: null,
    createdAt: "2026-05-14T03:00:00Z",
  },
]
