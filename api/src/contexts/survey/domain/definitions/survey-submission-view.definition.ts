import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
export type SurveySubmissionView = {
  id: number
  surveyId: number
  respondentId: EmployeeId
  answersJson: unknown
  submittedAt: string
}
