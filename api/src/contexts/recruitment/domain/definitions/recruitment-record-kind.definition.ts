import { z } from "zod"

export const recruitmentRecordKinds = [
  "recruitment-position-record",
  "recruitment-candidate-record",
] as const

export const recruitmentRecordKindSchema = z.enum(recruitmentRecordKinds)
export type RecruitmentRecordKind = z.infer<typeof recruitmentRecordKindSchema>
