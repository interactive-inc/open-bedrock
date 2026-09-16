import { z } from "zod"

export const regulationRecordKinds = ["regulation-record", "regulation-version-record"] as const

export const regulationRecordKindSchema = z.enum(regulationRecordKinds)
export type RegulationRecordKind = z.infer<typeof regulationRecordKindSchema>
