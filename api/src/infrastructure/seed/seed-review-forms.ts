type SeedReviewForm = {
  id: number
  cycleId: number
  subjectEmployeeId: number
  reviewerEmployeeId: number
  reviewerType: "self" | "manager" | "peer" | "subordinate"
  answers: ReadonlyArray<unknown>
  score: number | null
  comment: string | null
  status: "pending" | "submitted"
  submittedAt: string | null
}

/** 1サイクル・1被評価者に self/manager/peer のフォームを割り当てる。 */
export const seedReviewForms: ReadonlyArray<SeedReviewForm> = [
  {
    id: 1,
    cycleId: 1,
    subjectEmployeeId: 5,
    reviewerEmployeeId: 5,
    reviewerType: "self",
    answers: [],
    score: null,
    comment: null,
    status: "pending",
    submittedAt: null,
  },
  {
    id: 2,
    cycleId: 1,
    subjectEmployeeId: 5,
    reviewerEmployeeId: 4,
    reviewerType: "manager",
    answers: [],
    score: null,
    comment: null,
    status: "pending",
    submittedAt: null,
  },
  {
    id: 3,
    cycleId: 2,
    subjectEmployeeId: 5,
    reviewerEmployeeId: 4,
    reviewerType: "manager",
    answers: ["Strong collaboration"],
    score: 80,
    comment: "Great teamwork this quarter",
    status: "submitted",
    submittedAt: "2025-12-20T00:00:00Z",
  },
]
