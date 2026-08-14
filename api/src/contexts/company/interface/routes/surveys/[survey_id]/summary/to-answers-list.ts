import type { SurveyResponse } from "@/contexts/company/domain/survey/survey-response.entity"
import { z } from "zod"

const answersMapSchema = z.record(z.string(), z.unknown())

export function toAnswersList(
  responses: ReadonlyArray<SurveyResponse>,
): ReadonlyArray<Record<string, unknown>> {
  const answersList: Array<Record<string, unknown>> = []

  for (const response of responses) {
    const parsed = answersMapSchema.safeParse(response.answersJson)

    if (parsed.success) {
      answersList.push(parsed.data)
    }
  }

  return answersList
}
