import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** ===== survey ===== */
export const zAppSurvey = z.object({
  id: z.number(),
  title: z.string(),
  status: z.enum(["open", "closed"]),
  questions_json: z.array(z.unknown()),
})

export type AppSurvey = z.infer<typeof zAppSurvey>

export const zAppSurveyList = z.object({
  data: z.array(zAppSurvey),
  total: z.number(),
})

export const zAppSurveyResponse = z.object({
  id: z.number().nullable(),
  survey_id: z.number(),
  respondent_id: zEmployeeId,
  answers_json: z.unknown(),
  submitted_at: z.string(),
})

export type AppSurveyResponse = z.infer<typeof zAppSurveyResponse>

export const zAppSurveyResponseList = z.object({
  data: z.array(zAppSurveyResponse),
  total: z.number(),
})

export const zAppSurveySummaryQuestion = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["scale", "choice", "text"]),
  distribution: z.record(z.string(), z.number()),
  answers: z.array(z.string()),
})

export const zAppSurveySummary = z.object({
  survey_id: z.number(),
  title: z.string(),
  response_count: z.number(),
  is_truncated: z.boolean(),
  questions: z.array(zAppSurveySummaryQuestion),
})
