import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export type SurveySubmissionView = {
  id: string
  surveyId: string
  respondentId: EmployeeId
  answersJson: unknown
  submittedAt: string
}
