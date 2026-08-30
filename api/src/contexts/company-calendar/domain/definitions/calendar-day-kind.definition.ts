import { z } from "zod"

export const calendarDayKindSchema = z.enum(["holiday", "workday"])

export type CalendarDayKind = z.infer<typeof calendarDayKindSchema>
