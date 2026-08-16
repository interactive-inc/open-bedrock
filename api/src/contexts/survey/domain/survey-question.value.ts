import { z } from "zod"

export const surveyQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(["scale", "choice", "text"]),
  text: z.string(),
})

export type SurveyQuestion = z.infer<typeof surveyQuestionSchema>
