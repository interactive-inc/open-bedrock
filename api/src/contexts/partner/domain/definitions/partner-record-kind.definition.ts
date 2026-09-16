import { z } from "zod"

export const partnerRecordKinds = ["partner-record", "partner-contract-record"] as const

export const partnerRecordKindSchema = z.enum(partnerRecordKinds)
export type PartnerRecordKind = z.infer<typeof partnerRecordKindSchema>
