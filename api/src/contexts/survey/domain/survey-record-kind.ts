import { z } from "zod"

export const surveyRecordKinds = ["survey-record", "survey-response-record"] as const
export const surveyRecordKindSchema = z.enum(surveyRecordKinds)
export type SurveyRecordKind = z.infer<typeof surveyRecordKindSchema>
