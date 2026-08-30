import { z } from "zod"

export const lifeEventTypeSchema = z.enum([
  "marriage",
  "divorce",
  "childbirth",
  "relocation",
  "dependent_added",
  "dependent_removed",
])

export type LifeEventType = z.infer<typeof lifeEventTypeSchema>
