import { z } from "zod"

export const careerRecordKinds = [
  "career-posting-record",
  "career-application-record",
  "career-sheet-record",
] as const
export const careerRecordKindSchema = z.enum(careerRecordKinds)
export type CareerRecordKind = z.infer<typeof careerRecordKindSchema>
