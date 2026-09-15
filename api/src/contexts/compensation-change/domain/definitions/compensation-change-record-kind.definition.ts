import { z } from "zod"

export const compensationChangeRecordKinds = ["salary-revision-record"] as const
export const compensationChangeRecordKindSchema = z.enum(compensationChangeRecordKinds)
export type CompensationChangeRecordKind = z.infer<typeof compensationChangeRecordKindSchema>
