import { z } from "zod"

export const meetingRecordKinds = [
  "meeting-record",
  "meeting-minutes-record",
  "meeting-decision-record",
] as const

export const meetingRecordKindSchema = z.enum(meetingRecordKinds)
export type MeetingRecordKind = z.infer<typeof meetingRecordKindSchema>
