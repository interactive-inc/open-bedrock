import { z } from "zod"

export const ringiRecordKinds = ["ringi-request-record", "ringi-procedure-binding-record"] as const

export const ringiRecordKindSchema = z.enum(ringiRecordKinds)
export type RingiRecordKind = z.infer<typeof ringiRecordKindSchema>

/** 空文字を含む案件キーをURL上でも一意の非空IDとして表す。 */
export function encodeRingiProcedureBindingRecordId(requestKey: string): string {
  return `key:${requestKey}`
}

export function decodeRingiProcedureBindingRecordId(recordId: string): string | null {
  return recordId.startsWith("key:") ? recordId.slice(4) : null
}
