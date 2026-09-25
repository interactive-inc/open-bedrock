import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

type SeedReviewForm = {
  id: string
  cycleId: string
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
    id: "01900033-0000-7000-8000-000000000001",
    cycleId: "01900032-0000-7000-8000-000000000001",
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
    id: "01900033-0000-7000-8000-000000000002",
    cycleId: "01900032-0000-7000-8000-000000000001",
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
    id: "01900033-0000-7000-8000-000000000003",
    cycleId: "01900032-0000-7000-8000-000000000002",
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
