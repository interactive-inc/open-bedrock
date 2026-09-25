import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

type SeedSurveyResponse = {
  id: string
  surveyId: string
  respondentId: EmployeeId
  answersJson: unknown
  submittedAt: string
}

export const seedSurveyResponses: ReadonlyArray<SeedSurveyResponse> = [
  {
    id: "01900027-0000-7000-8000-000000000001",
    surveyId: "01900026-0000-7000-8000-000000000001",
    respondentId: toWorkforceEmployeeId(5),
    answersJson: { q1: 4, q2: 5, q3: "特にありません" },
    submittedAt: "2026-05-10T01:00:00Z",
  },
  {
    id: "01900027-0000-7000-8000-000000000002",
    surveyId: "01900026-0000-7000-8000-000000000001",
    respondentId: toWorkforceEmployeeId(9),
    answersJson: { q1: 5, q2: 4, q3: "リモートワーク手当を拡充してほしい" },
    submittedAt: "2026-05-11T02:00:00Z",
  },
  {
    id: "01900027-0000-7000-8000-000000000003",
    surveyId: "01900026-0000-7000-8000-000000000001",
    respondentId: toWorkforceEmployeeId(10),
    answersJson: { q1: 3, q2: 3, q3: "" },
    submittedAt: "2026-05-12T03:00:00Z",
  },
]
