import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
type SeedReviewForm = {
  id: number
  cycleId: number
  subjectEmployeeId: EmployeeId
  reviewerEmployeeId: EmployeeId
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
    subjectEmployeeId: toWorkforceEmployeeId(5),
    reviewerEmployeeId: toWorkforceEmployeeId(5),
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
    subjectEmployeeId: toWorkforceEmployeeId(5),
    reviewerEmployeeId: toWorkforceEmployeeId(4),
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
    subjectEmployeeId: toWorkforceEmployeeId(5),
    reviewerEmployeeId: toWorkforceEmployeeId(4),
    reviewerType: "manager",
    answers: ["優れた協調性"],
    score: 80,
    comment: "今期は素晴らしいチームワークだった",
    status: "submitted",
    submittedAt: "2025-12-20T00:00:00Z",
  },
]
