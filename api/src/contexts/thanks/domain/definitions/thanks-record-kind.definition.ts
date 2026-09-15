import { z } from "zod"

export const thanksRecordKinds = [
  "thanks-message-record",
  "thanks-point-budget-record",
  "thanks-reward-record",
  "thanks-redemption-record",
] as const

export const thanksRecordKindSchema = z.enum(thanksRecordKinds)
export type ThanksRecordKind = z.infer<typeof thanksRecordKindSchema>
