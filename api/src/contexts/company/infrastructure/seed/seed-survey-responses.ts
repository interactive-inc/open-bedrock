type SeedSurveyResponse = {
  id: number
  surveyId: number
  respondentId: number
  answersJson: unknown
  submittedAt: string
}

export const seedSurveyResponses: ReadonlyArray<SeedSurveyResponse> = [
  {
    id: 1,
    surveyId: 1,
    respondentId: 5,
    answersJson: { q1: 4, q2: 5, q3: "特にありません" },
    submittedAt: "2026-05-10T01:00:00Z",
  },
  {
    id: 2,
    surveyId: 1,
    respondentId: 9,
    answersJson: { q1: 5, q2: 4, q3: "リモートワーク手当を拡充してほしい" },
    submittedAt: "2026-05-11T02:00:00Z",
  },
  {
    id: 3,
    surveyId: 1,
    respondentId: 10,
    answersJson: { q1: 3, q2: 3, q3: "" },
    submittedAt: "2026-05-12T03:00:00Z",
  },
]
