import { z } from "zod"

export const roomRecordKinds = ["room-record", "room-reservation-record"] as const

export const roomRecordKindSchema = z.enum(roomRecordKinds)
export type RoomRecordKind = z.infer<typeof roomRecordKindSchema>
