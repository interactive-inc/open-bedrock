import { z } from "zod"

export const shiftRecordKinds = [
  "shift-pattern-record",
  "shift-assignment-record",
  "shift-swap-request-record",
] as const

export const shiftRecordKindSchema = z.enum(shiftRecordKinds)
export type ShiftRecordKind = z.infer<typeof shiftRecordKindSchema>
